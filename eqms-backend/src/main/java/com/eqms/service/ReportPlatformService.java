package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.DocumentRecord;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.support.CronExpression;
import com.eqms.entity.UserStatus;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.io.ByteArrayOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import java.util.*;

/**
 * Controlled entry point for the report platform. This intentionally accepts only
 * definition-owned parameters; it never accepts SQL, arbitrary fields or joins.
 * Rendering workers consume the queued immutable snapshots in report_runs.
 */
@Service
public class ReportPlatformService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final PermissionEvaluationService permissions;
    private final DocumentRecordRepository documents;
    private final UserAccountRepository users;
    private final DocumentAuthorizationService documentAuthorization;
    private final FileStorageService fileStorage;
    private final AuditTrailService auditTrail;

    public ReportPlatformService(JdbcTemplate jdbc, ObjectMapper objectMapper, PermissionEvaluationService permissions, DocumentRecordRepository documents, UserAccountRepository users, DocumentAuthorizationService documentAuthorization, FileStorageService fileStorage, AuditTrailService auditTrail) {
        this.jdbc = jdbc; this.objectMapper = objectMapper; this.permissions = permissions; this.documents=documents; this.users=users; this.documentAuthorization=documentAuthorization; this.fileStorage=fileStorage; this.auditTrail=auditTrail;
    }

    public List<Map<String, Object>> catalog(UserAccount actor) {
        require(actor, "reports.catalog.view", "report.module.view");
        return jdbc.queryForList("""
                select d.code, d.display_name as \"displayName\", d.description, d.category, d.classification,
                       d.definition_version as \"definitionVersion\", d.allowed_formats as \"allowedFormats\", d.limits,
                       d.access_policy as \"accessPolicy\", coalesce(json_agg(json_build_object('code', f.field_code,
                         'name', f.display_name, 'type', f.field_type, 'allowed', f.allowed, 'defaultSelected',
                         f.default_selected, 'required', f.required, 'order', f.display_order) order by f.display_order)
                         filter (where f.id is not null), '[]') as fields
                from report_definitions d left join report_definition_fields f on f.definition_code=d.code
                where d.active=true group by d.code order by d.category, d.display_name
                """);
    }

    public List<Map<String,Object>> configuration(UserAccount actor) {
        require(actor,"reports.definition.view","settings.configuration.view");
        return jdbc.queryForList("select d.code, d.display_name as \"displayName\", d.description, d.category, d.classification, d.active, d.definition_version as \"definitionVersion\", d.allowed_formats as \"allowedFormats\", d.limits, d.access_policy as \"accessPolicy\", d.delivery_policy as \"deliveryPolicy\", d.retention_policy_id as \"retentionPolicyId\", rp.name as \"retentionPolicyName\", rp.retention_days as \"retentionDays\", d.updated_at as \"updatedAt\" from report_definitions d left join retention_policies rp on rp.id=d.retention_policy_id order by d.category, d.display_name");
    }
    public Map<String,Object> configurationDetail(UserAccount actor, String code) {
        require(actor,"reports.definition.view","settings.configuration.view");
        Map<String,Object> result=new LinkedHashMap<>(jdbc.queryForMap("select d.code, d.display_name as \"displayName\", d.description, d.category, d.classification, d.active, d.definition_version as \"definitionVersion\", d.allowed_formats as \"allowedFormats\", d.limits, d.access_policy as \"accessPolicy\", d.delivery_policy as \"deliveryPolicy\", d.retention_policy_id as \"retentionPolicyId\", rp.name as \"retentionPolicyName\", rp.retention_days as \"retentionDays\" from report_definitions d left join retention_policies rp on rp.id=d.retention_policy_id where d.code=?",code));
        result.put("fields",jdbc.queryForList("select field_code as code, display_name as name, field_type as type, allowed, default_selected as \"defaultSelected\", required, display_order as \"order\" from report_definition_fields where definition_code=? order by display_order",code));
        return result;
    }
    public void updateConfiguration(UserAccount actor, String code, Map<String,Object> update) {
        require(actor,"reports.definition.manage","settings.configuration.edit");
        String reason=String.valueOf(update.getOrDefault("reason","")).trim(); if(reason.isEmpty()) throw new IllegalArgumentException("A reason is required for report configuration changes");
        Map<String,Object> before=configurationDetail(actor,code);
        UUID retentionPolicyId = null;
        boolean replaceRetentionPolicy = update.containsKey("retentionPolicyId");
        if (replaceRetentionPolicy && update.get("retentionPolicyId") != null && !String.valueOf(update.get("retentionPolicyId")).isBlank()) {
            retentionPolicyId = UUID.fromString(String.valueOf(update.get("retentionPolicyId")));
            Integer activePolicy = jdbc.queryForObject("select count(*) from retention_policies where id=? and is_active=true", Integer.class, retentionPolicyId);
            if (activePolicy == null || activePolicy != 1) throw new IllegalArgumentException("Retention policy must be active");
        }
        jdbc.update("update report_definitions set display_name=coalesce(?,display_name), description=coalesce(?,description), category=coalesce(?,category), classification=coalesce(?,classification), active=coalesce(?,active), retention_policy_id=case when ? then cast(? as uuid) else retention_policy_id end, updated_at=now(), definition_version=definition_version+1 where code=?",update.get("displayName"),update.get("description"),update.get("category"),update.get("classification"),update.get("active"),replaceRetentionPolicy,retentionPolicyId,code);
        Map<String,Object> after=configurationDetail(actor,code);
        jdbc.update("insert into report_definition_versions(definition_code,version,snapshot,reason,changed_by_user_id) values(?,?,cast(? as jsonb),?,?)",code,after.get("definitionVersion"),objectMapper.valueToTree(after).toString(),reason,actor.getId());
        auditTrail.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_CONFIGURATION_UPDATED", null, null, "Report definition configuration changed: " + reason);
    }
    public void updateFields(UserAccount actor, String code, Map<String,Object> request) {
        require(actor,"reports.definition.manage","settings.configuration.edit");
        String reason=String.valueOf(request.getOrDefault("reason","")).trim(); if(reason.isEmpty()) throw new IllegalArgumentException("A reason is required for report field changes");
        Object raw=request.get("fields"); if (!(raw instanceof List<?> fields)) throw new IllegalArgumentException("fields is required");
        for (Object item: fields) { if (!(item instanceof Map<?,?> map)) throw new IllegalArgumentException("Invalid field payload"); String field=String.valueOf(map.get("code")); Object rawOrder=map.get("order"); int order=rawOrder instanceof Number number ? number.intValue() : 0; boolean allowed=Boolean.TRUE.equals(map.get("allowed")); boolean required=Boolean.TRUE.equals(map.get("required")); boolean selected=required || Boolean.TRUE.equals(map.get("defaultSelected")); int updated=jdbc.update("update report_definition_fields set allowed=?, default_selected=?, required=?, display_order=? where definition_code=? and field_code=?",allowed,selected,required,order,code,field); if(updated!=1) throw new IllegalArgumentException("REPORT_FIELD_NOT_ALLOWED"); }
        jdbc.update("update report_definitions set definition_version=definition_version+1, updated_at=now() where code=?",code);
        Map<String,Object> after=configurationDetail(actor,code);
        jdbc.update("insert into report_definition_versions(definition_code,version,snapshot,reason,changed_by_user_id) values(?,?,cast(? as jsonb),?,?)",code,after.get("definitionVersion"),objectMapper.valueToTree(after).toString(),reason,actor.getId());
        auditTrail.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_FIELDS_UPDATED", null, null, "Report field defaults changed: " + reason);
    }
    public List<Map<String,Object>> configurationHistory(UserAccount actor, String code) {
        require(actor,"reports.definition.view","settings.configuration.view");
        return jdbc.queryForList("select version, reason, changed_by_user_id as \"changedByUserId\", created_at as \"createdAt\" from report_definition_versions where definition_code=? order by version desc", code);
    }

    public List<Map<String,Object>> schedules(UserAccount actor) {
        require(actor, "reports.schedule.view", "report.module.view");
        boolean manageAll = permissions.hasPermission(actor, "reports.schedule.manage");
        String scope = manageAll ? "" : "where s.creator_user_id=? ";
        return jdbc.queryForList("select s.id, s.name, s.definition_code as \"definitionCode\", s.cron_expression as \"cronExpression\", s.requested_format as format, s.status, s.active, s.next_run_at as \"nextRunAt\", s.last_run_at as \"lastRunAt\", s.creator_user_id as \"creatorUserId\" from report_schedules s " + scope + "order by s.next_run_at nulls last, s.created_at desc", manageAll ? new Object[]{} : new Object[]{actor.getId()});
    }

    public List<Map<String,Object>> recipientCandidates(UserAccount actor, String search) {
        require(actor, "reports.schedule.manage", "report.module.export");
        String term = "%" + (search == null ? "" : search.trim()) + "%";
        return jdbc.queryForList("select id, full_name as \"fullName\", employee_code as \"employeeCode\", email, department, business_unit as \"businessUnit\" from app_users where status='Active' and (full_name ilike ? or employee_code ilike ? or email ilike ?) order by full_name limit 30", term, term, term).stream().filter(candidate -> users.findById(UUID.fromString(candidate.get("id").toString())).map(this::hasArtifactDownloadPermission).orElse(false)).toList();
    }

    public UUID createSchedule(UserAccount actor, ScheduleRequest request) {
        require(actor, "reports.schedule.manage", "report.module.export");
        if (request == null || request.name() == null || request.name().isBlank() || request.definitionCode() == null || request.definitionCode().isBlank()) throw new IllegalArgumentException("Schedule name and definition are required");
        CronExpression cron = parseCron(request.cronExpression());
        Map<String,Object> definition = jdbc.queryForMap("select * from report_definitions where code=? and active=true", request.definitionCode());
        String format = request.format() == null ? "CSV" : request.format().toUpperCase(Locale.ROOT);
        validateFormat(definition, format); validateFields(request.definitionCode(), request.fields());
        List<UUID> recipients = request.recipientUserIds() == null ? List.of() : request.recipientUserIds().stream().distinct().toList();
        for (UUID recipientId : recipients) {
            UserAccount recipient = users.findById(recipientId).orElseThrow(() -> new IllegalArgumentException("Recipient does not exist"));
            if (recipient.getStatus() != UserStatus.Active || !hasArtifactDownloadPermission(recipient)) throw new IllegalArgumentException("Schedule recipients must be active users with report download permission");
        }
        Instant next = cron.next(Instant.now()); if (next == null) throw new IllegalArgumentException("Cron expression has no future occurrence");
        UUID id = UUID.randomUUID(); JsonNode snapshot = objectMapper.valueToTree(Map.of("creatorId", actor.getId().toString(), "definitionVersion", definition.get("definition_version"), "capturedAt", Instant.now().toString()));
        jdbc.update("insert into report_schedules(id,definition_code,creator_user_id,name,cron_expression,requested_format,parameters,selected_fields,authorization_snapshot,next_run_at) values(?,?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),?)", id, request.definitionCode(), actor.getId(), request.name().trim(), request.cronExpression().trim(), format, safeJson(request.parameters()).toString(), safeJson(request.fields()).toString(), snapshot.toString(), java.sql.Timestamp.from(next));
        for (UUID recipient : recipients) jdbc.update("insert into report_schedule_recipients(schedule_id,user_id) values(?,?)", id, recipient);
        auditTrail.logAs(actor, "REPORT_SCHEDULE", request.name().trim(), id, "REPORT_SCHEDULE_CREATED", null, "ACTIVE", "Scheduled report created for " + request.definitionCode());
        return id;
    }

    public void pauseSchedule(UserAccount actor, UUID id) { updateScheduleStatus(actor, id, false, "PAUSED"); }
    public void resumeSchedule(UserAccount actor, UUID id) {
        require(actor, "reports.schedule.manage", "report.module.export"); requireScheduleManagement(actor, id);
        Map<String,Object> row = jdbc.queryForMap("select cron_expression from report_schedules where id=?", id);
        Instant next = parseCron(String.valueOf(row.get("cron_expression"))).next(Instant.now()); if (next == null) throw new IllegalArgumentException("Cron expression has no future occurrence");
        jdbc.update("update report_schedules set active=true,status='ACTIVE',next_run_at=?,updated_at=now() where id=?", java.sql.Timestamp.from(next), id);
        auditTrail.logAs(actor, "REPORT_SCHEDULE", id.toString(), id, "REPORT_SCHEDULE_RESUMED", null, "ACTIVE", "Scheduled report resumed");
    }
    public void deleteSchedule(UserAccount actor, UUID id) { require(actor, "reports.schedule.manage", "report.module.export"); requireScheduleManagement(actor,id); jdbc.update("delete from report_schedules where id=?",id); auditTrail.logAs(actor, "REPORT_SCHEDULE", id.toString(), id, "REPORT_SCHEDULE_DELETED", null, null, "Scheduled report deleted"); }
    private void updateScheduleStatus(UserAccount actor, UUID id, boolean active, String status) { require(actor, "reports.schedule.manage", "report.module.export"); requireScheduleManagement(actor,id); jdbc.update("update report_schedules set active=?,status=?,updated_at=now() where id=?",active,status,id); auditTrail.logAs(actor, "REPORT_SCHEDULE", id.toString(), id, "REPORT_SCHEDULE_" + status, null, status, "Scheduled report status changed"); }
    private void requireScheduleManagement(UserAccount actor, UUID id) { Integer exists = jdbc.queryForObject("select count(*) from report_schedules where id=?", Integer.class, id); if (exists == null || exists != 1) throw new IllegalArgumentException("Report schedule not found"); }
    private CronExpression parseCron(String value) { try { return CronExpression.parse(value == null ? "" : value.trim()); } catch (Exception invalid) { throw new IllegalArgumentException("Invalid cron expression"); } }

    public UUID queueRun(UserAccount actor, RunRequest request, String idempotencyKey) {
        require(actor, "reports.run.create", "report.module.export");
        Map<String, Object> definition = jdbc.queryForMap("select * from report_definitions where code=? and active=true", request.definitionCode());
        validateFormat(definition, request.format());
        validateFields(request.definitionCode(), request.fields());
        UUID id = UUID.randomUUID();
        JsonNode parameters = safeJson(request.parameters());
        JsonNode fields = safeJson(request.fields());
        JsonNode sort = safeJson(request.sort());
        JsonNode authSnapshot = objectMapper.valueToTree(Map.of("requesterId", actor.getId().toString(), "capturedAt", Instant.now().toString()));
        jdbc.update("""
                insert into report_runs(id,definition_code,definition_version,requester_user_id,request_type,requested_format,parameters,selected_fields,sort_spec,authorization_snapshot,status,idempotency_key)
                values(?,?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),'QUEUED',?)
                on conflict(requester_user_id,idempotency_key) do nothing
                """, id, request.definitionCode(), definition.get("definition_version"), actor.getId(), "ON_DEMAND",
                request.format().toUpperCase(Locale.ROOT), parameters.toString(), fields.toString(), sort.toString(), authSnapshot.toString(), normalizeKey(idempotencyKey));
        UUID resolved = jdbc.query("select id from report_runs where requester_user_id=? and idempotency_key=?", rs -> rs.next() ? UUID.fromString(rs.getString(1)) : id,
                actor.getId(), normalizeKey(idempotencyKey));
        jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?, 'QUEUED', cast(? as jsonb))", resolved,
                objectMapper.valueToTree(Map.of("definition", request.definitionCode(), "format", request.format())).toString());
        auditTrail.logAs(actor, "REPORT_RUN", request.definitionCode(), resolved, "REPORT_RUN_QUEUED", null, "QUEUED", "Report run requested; definition version " + definition.get("definition_version"));
        return resolved;
    }

    public Map<String, Object> runs(UserAccount actor, String search, int page, int limit, String sortBy, String sortDirection) {
        require(actor, "reports.run.view_own", "report.module.view");
        boolean all = permissions.hasPermission(actor, "reports.run.view_all");
        int safeLimit = Math.min(Math.max(limit, 1), 100); int safePage = Math.max(page, 1); int offset = (safePage - 1) * safeLimit;
        String where = all ? "" : "and r.requester_user_id=?";
        String term = "%" + (search == null ? "" : search.trim()) + "%";
        String orderColumn = switch (sortBy == null ? "queuedAt" : sortBy) {
            case "definitionCode" -> "r.definition_code";
            case "status" -> "r.status";
            case "completedAt" -> "r.completed_at";
            default -> "r.queued_at";
        };
        String direction = "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc";
        List<Object> dataArgs = new ArrayList<>(List.of(term, term));
        if (!all) dataArgs.add(actor.getId());
        dataArgs.add(safeLimit); dataArgs.add(offset);
        List<Map<String, Object>> data = jdbc.queryForList("select r.id, r.definition_code as \"definitionCode\", r.definition_version as \"definitionVersion\", r.status, r.progress, r.reason_code as \"reasonCode\", r.error_message as \"errorMessage\", r.queued_at as \"queuedAt\", r.completed_at as \"completedAt\", a.id as \"artifactId\" from report_runs r left join report_artifacts a on a.run_id=r.id where (r.definition_code ilike ? or cast(r.id as text) ilike ?) " + where + " order by " + orderColumn + " " + direction + " nulls last, r.id desc limit ? offset ?", dataArgs.toArray());
        List<Object> countArgs = new ArrayList<>(List.of(term, term)); if (!all) countArgs.add(actor.getId());
        Long total = jdbc.queryForObject("select count(*) from report_runs r where (r.definition_code ilike ? or cast(r.id as text) ilike ?) " + where, Long.class, countArgs.toArray());
        long resolvedTotal = total == null ? 0 : total;
        return Map.of("data", data, "pagination", Map.of("page", safePage, "limit", safeLimit, "total", resolvedTotal, "totalPages", (int) Math.ceil((double) resolvedTotal / safeLimit)));
    }

    /** Metadata-only run detail. Artifact bytes remain available only through the re-authorized download endpoint. */
    public Map<String,Object> runDetail(UserAccount actor, UUID runId) {
        require(actor, "reports.run.view_own", "report.module.view");
        Map<String,Object> run = new LinkedHashMap<>(jdbc.queryForMap("select id, definition_code as \"definitionCode\", definition_version as \"definitionVersion\", requester_user_id as \"requesterUserId\", request_type as \"requestType\", requested_format as \"requestedFormat\", parameters, selected_fields as \"selectedFields\", sort_spec as \"sortSpec\", authorization_snapshot as \"authorizationSnapshot\", status, progress, attempt_count as \"attemptCount\", reason_code as \"reasonCode\", error_message as \"errorMessage\", queued_at as \"queuedAt\", started_at as \"startedAt\", completed_at as \"completedAt\" from report_runs where id=?", runId));
        boolean all = permissions.hasPermission(actor, "reports.run.view_all");
        if (!all && !actor.getId().toString().equals(String.valueOf(run.get("requesterUserId")))) throw new SecurityException("REPORT_SCOPE_DENIED");
        run.put("artifacts", jdbc.queryForList("select id, format, generated_filename as \"generatedFilename\", mime_type as \"mimeType\", byte_size as \"byteSize\", sha256, expires_at as \"expiresAt\", legal_hold as \"legalHold\", purged_at as \"purgedAt\", created_at as \"createdAt\" from report_artifacts where run_id=? order by created_at", runId));
        run.put("events", jdbc.queryForList("select event_type as \"eventType\", reason_code as \"reasonCode\", detail, created_at as \"createdAt\" from report_run_events where run_id=? order by created_at", runId));
        return run;
    }

    /** Limited, non-official preview. It does not create an artifact or enter report history. */
    public Map<String,Object> preview(UserAccount actor, String definitionCode, List<String> fields) {
        require(actor, "reports.run.create", "report.module.export");
        jdbc.queryForMap("select code from report_definitions where code=? and active=true", definitionCode);
        validateFields(definitionCode, fields);
        RenderedReport preview = renderRows(definitionCode, actor, fields, 100);
        return Map.of("definitionCode", definitionCode, "asOfAt", Instant.now().toString(), "rows", preview.rows(), "truncated", preview.sourceDocumentIds().size() >= 100);
    }

    public DownloadArtifact download(UserAccount actor, UUID runId, UUID artifactId) {
        require(actor, "reports.artifact.download", "report.module.export");
        Map<String,Object> artifact=jdbc.queryForMap("""
                select a.generated_filename, a.mime_type, a.object_key, a.provider, r.requester_user_id, r.definition_code, r.authorization_snapshot
                from report_artifacts a join report_runs r on r.id=a.run_id
                where a.id=? and a.run_id=? and a.purged_at is null and (a.expires_at is null or a.expires_at > now())
                """,artifactId, runId);
        boolean canViewAll=permissions.hasPermission(actor,"reports.run.view_all");
        if (!canViewAll && !actor.getId().toString().equals(String.valueOf(artifact.get("requester_user_id")))) throw new SecurityException("REPORT_SCOPE_DENIED");
        reauthorizeArtifactScope(actor, String.valueOf(artifact.get("definition_code")), String.valueOf(artifact.get("authorization_snapshot")));
        try { auditTrail.logAs(actor, "REPORT_ARTIFACT", String.valueOf(artifact.get("generated_filename")), artifactId, "REPORT_ARTIFACT_DOWNLOADED", null, null, "Artifact download authorized and source scope re-evaluated"); return new DownloadArtifact(String.valueOf(artifact.get("generated_filename")), String.valueOf(artifact.get("mime_type")), fileStorage.readReportArtifact(String.valueOf(artifact.get("provider")), String.valueOf(artifact.get("object_key")))); }
        catch (Exception missing) { throw new IllegalStateException("REPORT_ARTIFACT_EXPIRED"); }
    }

    public void retryRun(UserAccount actor, UUID runId) {
        require(actor, "reports.run.create", "report.module.export");
        Map<String,Object> run = jdbc.queryForMap("select requester_user_id,status from report_runs where id=?", runId);
        boolean all = permissions.hasPermission(actor, "reports.run.view_all");
        if (!all && !actor.getId().toString().equals(String.valueOf(run.get("requester_user_id")))) throw new SecurityException("REPORT_SCOPE_DENIED");
        if (!Set.of("FAILED", "RETRY_SCHEDULED").contains(String.valueOf(run.get("status")))) throw new IllegalStateException("REPORT_GENERATION_FAILED");
        jdbc.update("update report_runs set status='QUEUED',reason_code=null,error_message=null,next_attempt_at=now(),lease_until=null where id=?", runId);
        jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?,'RETRY_REQUESTED',cast(? as jsonb))",runId,objectMapper.valueToTree(Map.of("requestedBy",actor.getId().toString())).toString());
        auditTrail.logAs(actor, "REPORT_RUN", runId.toString(), runId, "REPORT_RUN_RETRY_REQUESTED", String.valueOf(run.get("status")), "QUEUED", "Retry requested");
    }

    private void reauthorizeArtifactScope(UserAccount actor, String definitionCode, String rawSnapshot) {
        if (!"DOCUMENT_STATUS".equals(definitionCode)) return;
        try {
            JsonNode snapshot = objectMapper.readTree(rawSnapshot);
            JsonNode ids = snapshot.path("sourceDocumentIds");
            if (!ids.isArray()) throw new SecurityException("REPORT_AUTHORIZATION_CHANGED");
            for (JsonNode id : ids) {
                DocumentRecord document = documents.findById(UUID.fromString(id.asText())).orElseThrow(() -> new SecurityException("REPORT_AUTHORIZATION_CHANGED"));
                if (!documentAuthorization.canViewDocument(actor, document)) throw new SecurityException("REPORT_AUTHORIZATION_CHANGED");
            }
        } catch (SecurityException denied) { throw denied; }
        catch (Exception malformed) { throw new SecurityException("REPORT_AUTHORIZATION_CHANGED"); }
    }

    private JsonNode safeJson(Object value) { return value == null ? objectMapper.createObjectNode() : objectMapper.valueToTree(value); }
    private Instant resolveRetentionExpiry(String definitionCode) {
        Integer days = jdbc.queryForObject("select rp.retention_days from report_definitions d join retention_policies rp on rp.id=d.retention_policy_id where d.code=? and rp.is_active=true", Integer.class, definitionCode);
        return days == null ? null : Instant.now().plus(java.time.Duration.ofDays(days));
    }
    private String normalizeKey(String key) { return key == null || key.isBlank() ? UUID.randomUUID().toString() : key.substring(0, Math.min(key.length(), 160)); }
    private void validateFormat(Map<String,Object> definition, String format) {
        String allowed=String.valueOf(definition.get("allowed_formats")); if (format == null || !allowed.contains("\"" + format.toUpperCase(Locale.ROOT) + "\"")) throw new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED");
    }
    private void validateFields(String definitionCode, List<String> fields) {
        if (fields == null || fields.isEmpty()) return;
        Integer illegal=jdbc.queryForObject("select count(*) from unnest(?::text[]) x where not exists (select 1 from report_definition_fields f where f.definition_code=? and f.field_code=x and f.allowed=true)", Integer.class, fields.toArray(String[]::new), definitionCode);
        if (illegal != null && illegal > 0) throw new IllegalArgumentException("REPORT_FIELD_NOT_ALLOWED");
    }
    private boolean hasArtifactDownloadPermission(UserAccount user) { return permissions.hasPermission(user, "reports.artifact.download") || permissions.hasPermission(user, "report.module.export"); }
    private void require(UserAccount actor, String modern, String legacy) { if (!permissions.hasPermission(actor, modern) && !permissions.hasPermission(actor, legacy)) throw new SecurityException("REPORT_SCOPE_DENIED"); }

    /** Called by the scheduled worker. Claiming is deliberately lease-based and does not execute in an HTTP thread. */
    public boolean processOneQueuedRun() {
        List<Map<String,Object>> candidates=jdbc.queryForList("""
                with candidate as (select id from report_runs where status in ('QUEUED','RETRY_SCHEDULED') and next_attempt_at <= now()
                  order by queued_at for update skip locked limit 1)
                update report_runs r set status='PROCESSING', started_at=now(), progress=10,
                  attempt_count=attempt_count+1, lease_until=now()+interval '10 minutes'
                from candidate where r.id=candidate.id
                returning r.id, r.definition_code, r.requester_user_id, r.requested_format, r.selected_fields, r.parameters
                """);
        if (candidates.isEmpty()) return false;
        Map<String,Object> run=candidates.getFirst(); UUID runId=UUID.fromString(run.get("id").toString());
        try {
            UserAccount requester=users.findById(UUID.fromString(run.get("requester_user_id").toString())).orElseThrow();
            String format=run.get("requested_format").toString();
            List<String> selected=objectMapper.readValue(String.valueOf(run.get("selected_fields")), objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            RenderedReport report=renderRows(run.get("definition_code").toString(), requester, selected, 10_000);
            byte[] bytes=render(format, report.rows());
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            UUID artifactId=UUID.randomUUID(); String code=run.get("definition_code").toString().toLowerCase(Locale.ROOT);
            String extension=format.toLowerCase(Locale.ROOT); String artifactKey="reports/"+code+"/"+java.time.Year.now().getValue()+"/"+String.format("%02d",java.time.LocalDate.now().getMonthValue())+"/"+runId+"/"+artifactId+"."+extension;
            FileStorageService.StorageWriteResult stored = fileStorage.storeReportArtifact(artifactKey, new java.io.ByteArrayInputStream(bytes), mimeFor(format));
            if (!hash.equalsIgnoreCase(stored.checksum())) throw new IllegalStateException("REPORT_ARTIFACT_CHECKSUM_MISMATCH");
            Instant expiresAt = resolveRetentionExpiry(String.valueOf(run.get("definition_code")));
            jdbc.update("insert into report_artifacts(id,run_id,format,generated_filename,provider,bucket,object_key,object_version,mime_type,byte_size,sha256,expires_at) values(?,?,?,?,?,?,?,?,?,?,?,?)", artifactId,runId,format,code+"-"+runId+"."+extension,stored.provider(),stored.bucket(),stored.storedPath(),stored.versionId(),mimeFor(format),bytes.length,hash,expiresAt == null ? null : java.sql.Timestamp.from(expiresAt));
            jdbc.update("update report_runs set authorization_snapshot=jsonb_set(authorization_snapshot, '{sourceDocumentIds}', cast(? as jsonb)), status='COMPLETED', progress=100, completed_at=now(), lease_until=null where id=?", objectMapper.valueToTree(report.sourceDocumentIds()).toString(), runId);
            jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?, 'COMPLETED', cast(? as jsonb))",runId,objectMapper.valueToTree(Map.of("artifactId",artifactId,"sha256",hash)).toString());
        } catch (Exception failure) {
            Integer attempts = jdbc.queryForObject("select attempt_count from report_runs where id=?", Integer.class, runId);
            int attempt = attempts == null ? 1 : attempts;
            if (attempt < 3) {
                long delaySeconds = Math.min(300L, 15L * (1L << Math.max(0, attempt - 1)));
                jdbc.update("update report_runs set status='RETRY_SCHEDULED', reason_code='REPORT_GENERATION_FAILED', error_message=?, next_attempt_at=now()+(? * interval '1 second'), lease_until=null where id=?", safeFailureMessage(failure), delaySeconds, runId);
                jdbc.update("insert into report_run_events(run_id,event_type,reason_code,detail) values(?,'RETRY_SCHEDULED','REPORT_GENERATION_FAILED',cast(? as jsonb))", runId, objectMapper.valueToTree(Map.of("attempt",attempt,"delaySeconds",delaySeconds)).toString());
            } else {
                jdbc.update("update report_runs set status='FAILED', reason_code='REPORT_GENERATION_FAILED', error_message=?, lease_until=null where id=?",safeFailureMessage(failure),runId);
                jdbc.update("insert into report_run_events(run_id,event_type,reason_code,detail) values(?,'DEAD_LETTERED','REPORT_GENERATION_FAILED',cast(? as jsonb))", runId, objectMapper.valueToTree(Map.of("attempt",attempt)).toString());
            }
        }
        return true;
    }

    /** Recovers a run whose worker died or lost its lease without issuing a duplicate artifact. */
    public int recoverExpiredLeases() {
        return jdbc.update("update report_runs set status='RETRY_SCHEDULED', reason_code='REPORT_GENERATION_FAILED', error_message='Worker lease expired', next_attempt_at=now(), lease_until=null where status='PROCESSING' and lease_until is not null and lease_until<now()");
    }

    /** Purge only expired, non-held artifacts; the database row remains as immutable evidence. */
    public int purgeExpiredArtifacts() {
        List<Map<String,Object>> candidates = jdbc.queryForList("""
                with candidate as (
                    select id from report_artifacts
                    where expires_at <= now() and purged_at is null and legal_hold=false
                      and (purge_claimed_at is null or purge_claimed_at < now() - interval '10 minutes')
                    order by expires_at for update skip locked limit 20
                )
                update report_artifacts a set purge_claimed_at=now() from candidate
                where a.id=candidate.id returning a.id, a.run_id, a.object_key
                """);
        int purged = 0;
        for (Map<String,Object> artifact : candidates) {
            UUID artifactId = UUID.fromString(artifact.get("id").toString());
            UUID runId = UUID.fromString(artifact.get("run_id").toString());
            try {
                fileStorage.deleteReportArtifact(String.valueOf(artifact.get("object_key")));
                jdbc.update("update report_artifacts set purged_at=now(), purge_claimed_at=null where id=? and legal_hold=false", artifactId);
                jdbc.update("insert into report_run_events(run_id,event_type,reason_code,detail) values(?,'ARTIFACT_PURGED','REPORT_ARTIFACT_EXPIRED',cast(? as jsonb))", runId, objectMapper.valueToTree(Map.of("artifactId", artifactId.toString())).toString());
                purged++;
            } catch (Exception ignored) {
                jdbc.update("update report_artifacts set purge_claimed_at=null where id=? and purged_at is null", artifactId);
            }
        }
        return purged;
    }

    public void setArtifactLegalHold(UserAccount actor, UUID runId, UUID artifactId, boolean legalHold, String reason) {
        require(actor, "reports.retention.manage", "reports.definition.manage");
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("A reason is required to change a legal hold");
        int updated = jdbc.update("update report_artifacts set legal_hold=? where id=? and run_id=? and purged_at is null", legalHold, artifactId, runId);
        if (updated != 1) throw new IllegalArgumentException("REPORT_ARTIFACT_EXPIRED");
        jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?, ?, cast(? as jsonb))", runId, legalHold ? "LEGAL_HOLD_APPLIED" : "LEGAL_HOLD_RELEASED", objectMapper.valueToTree(Map.of("artifactId", artifactId.toString(), "actorId", actor.getId().toString(), "reason", reason.trim())).toString());
        auditTrail.logAs(actor, "REPORT_ARTIFACT", artifactId.toString(), artifactId, legalHold ? "REPORT_LEGAL_HOLD_APPLIED" : "REPORT_LEGAL_HOLD_RELEASED", null, null, reason.trim());
    }

    /** Runs schedules using the creator's current authorization; changed or revoked authorization suspends the schedule. */
    public boolean processOneDueSchedule() {
        List<Map<String,Object>> due = jdbc.queryForList("with candidate as (select id from report_schedules where active=true and status='ACTIVE' and next_run_at<=now() order by next_run_at for update skip locked limit 1) update report_schedules s set next_run_at=now()+interval '10 minutes',updated_at=now() from candidate where s.id=candidate.id returning s.*");
        if (due.isEmpty()) return false;
        Map<String,Object> schedule = due.getFirst(); UUID scheduleId = UUID.fromString(schedule.get("id").toString());
        try {
            UserAccount creator = users.findById(UUID.fromString(schedule.get("creator_user_id").toString())).orElseThrow();
            if (creator.getStatus() != UserStatus.Active || (!permissions.hasPermission(creator,"reports.run.create") && !permissions.hasPermission(creator,"report.module.export"))) { suspendSchedule(scheduleId, "SUSPENDED_AUTHORIZATION_CHANGED"); return true; }
            Map<String,Object> definition = jdbc.queryForMap("select * from report_definitions where code=? and active=true", schedule.get("definition_code"));
            String format = String.valueOf(schedule.get("requested_format")); validateFormat(definition, format);
            List<String> fields = objectMapper.readValue(String.valueOf(schedule.get("selected_fields")), objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)); validateFields(String.valueOf(schedule.get("definition_code")), fields);
            Instant next = parseCron(String.valueOf(schedule.get("cron_expression"))).next(Instant.now()); if (next == null) { suspendSchedule(scheduleId, "SUSPENDED_INVALID_SCHEDULE"); return true; }
            UUID runId = UUID.randomUUID(); JsonNode snapshot = objectMapper.valueToTree(Map.of("creatorId", creator.getId().toString(), "scheduleId", scheduleId.toString(), "capturedAt", Instant.now().toString()));
            jdbc.update("insert into report_runs(id,definition_code,definition_version,requester_user_id,request_type,requested_format,parameters,selected_fields,authorization_snapshot,status,idempotency_key) values(?,?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),cast(? as jsonb),'QUEUED',?)", runId, schedule.get("definition_code"), definition.get("definition_version"), creator.getId(), "SCHEDULED", format, String.valueOf(schedule.get("parameters")), String.valueOf(schedule.get("selected_fields")), snapshot.toString(), "schedule:"+scheduleId+":"+Instant.now().toEpochMilli());
            jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?,'SCHEDULED',cast(? as jsonb))", runId, objectMapper.valueToTree(Map.of("scheduleId",scheduleId.toString())).toString());
            jdbc.update("update report_schedules set last_run_at=now(),next_run_at=?,updated_at=now() where id=?", java.sql.Timestamp.from(next), scheduleId);
        } catch (SecurityException | IllegalArgumentException configurationFailure) {
            suspendSchedule(scheduleId, "SUSPENDED_AUTHORIZATION_CHANGED");
        } catch (Exception transientFailure) {
            // Infrastructure failures must not be misrepresented as an authorization revocation.
            // Keep the schedule active and retry on the next bounded worker interval.
            jdbc.update("update report_schedules set next_run_at=now()+interval '5 minutes',updated_at=now() where id=?", scheduleId);
        }
        return true;
    }
    private void suspendSchedule(UUID id, String reason) { jdbc.update("update report_schedules set active=false,status=?,updated_at=now() where id=?", reason, id); }
    private RenderedReport renderRows(String definition, UserAccount requester, List<String> requestedFields, int maxRows) {
        if (!"DOCUMENT_STATUS".equals(definition)) throw new IllegalArgumentException("No renderer registered for " + definition);
        List<String> fields=requestedFields==null || requestedFields.isEmpty()?List.of("documentNumber","documentName","status","department","businessUnit"):requestedFields;
        Map<String,String> labels=Map.of("documentNumber","Document Number","documentName","Document Title","status","Status","department","Department","businessUnit","Business Unit","effectiveDate","Effective Date");
        List<List<String>> rows=new ArrayList<>(); List<String> sourceIds = new ArrayList<>(); rows.add(fields.stream().map(labels::get).toList());
        documents.findAll().stream().filter(document -> documentAuthorization.canViewDocument(requester, document)).limit(Math.max(1, maxRows)).forEach(document -> { rows.add(fields.stream().map(field -> documentField(document,field)).toList()); sourceIds.add(document.getId().toString()); });
        return new RenderedReport(rows, sourceIds);
    }
    private String documentField(DocumentRecord document, String field) { return switch(field) { case "documentNumber" -> value(document.getDocumentNumber()); case "documentName" -> value(document.getDocumentName()); case "status" -> value(document.getStatus().getLabel()); case "department" -> value(document.getDepartment().getName()); case "businessUnit" -> value(document.getBusinessUnit().getName()); case "effectiveDate" -> value(document.getEffectiveDate()); default -> throw new IllegalArgumentException("REPORT_FIELD_NOT_ALLOWED"); }; }
    private byte[] render(String format, List<List<String>> rows) throws Exception { return switch(format) { case "CSV" -> renderCsv(rows).getBytes(StandardCharsets.UTF_8); case "XLSX" -> renderXlsx(rows); case "PDF" -> renderPdf(rows); default -> throw new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED"); }; }
    private String renderCsv(List<List<String>> rows) { StringBuilder out=new StringBuilder(); rows.forEach(row -> out.append(row.stream().map(this::csv).collect(java.util.stream.Collectors.joining(","))).append('\n')); return out.toString(); }
    private byte[] renderXlsx(List<List<String>> rows) throws Exception { try (XSSFWorkbook book=new XSSFWorkbook(); ByteArrayOutputStream out=new ByteArrayOutputStream()) { var sheet=book.createSheet("Report"); for(int r=0;r<rows.size();r++){var excelRow=sheet.createRow(r); for(int c=0;c<rows.get(r).size();c++) excelRow.createCell(c).setCellValue(rows.get(r).get(c));} for(int c=0;c<rows.getFirst().size();c++) sheet.autoSizeColumn(c); book.write(out); return out.toByteArray(); } }
    private byte[] renderPdf(List<List<String>> rows) throws Exception { try(PDDocument pdf=new PDDocument(); ByteArrayOutputStream out=new ByteArrayOutputStream()) { PDPage page=new PDPage(PDRectangle.A4); pdf.addPage(page); try(PDPageContentStream stream=new PDPageContentStream(pdf,page)){stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),8); float y=800; for(List<String> row:rows){String line=String.join(" | ",row).replaceAll("[\\r\\n]"," ");stream.beginText();stream.newLineAtOffset(28,y);stream.showText(line.substring(0,Math.min(110,line.length())));stream.endText(); y-=14;if(y<25)break;}}pdf.save(out);return out.toByteArray();} }
    private String mimeFor(String format) { return switch(format) { case "PDF" -> "application/pdf"; case "XLSX" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; default -> "text/csv; charset=utf-8"; }; }
    private String value(Object value) { return value==null?"":String.valueOf(value); }
    private String csv(String value) { String v=value==null?"":value.replace("\"","\"\""); if (v.startsWith("=")||v.startsWith("+")||v.startsWith("-")||v.startsWith("@")) v="'"+v; return "\""+v+"\""; }
    private String safeFailureMessage(Exception exception) { return exception.getClass().getSimpleName()+": report generation failed"; }

    public record RunRequest(String definitionCode, String format, Map<String,Object> parameters, List<String> fields, List<Map<String,String>> sort) {}
    public record ScheduleRequest(String name, String definitionCode, String cronExpression, String format, Map<String,Object> parameters, List<String> fields, List<UUID> recipientUserIds) {}
    public record DownloadArtifact(String filename, String mimeType, byte[] bytes) {}
    private record RenderedReport(List<List<String>> rows, List<String> sourceDocumentIds) {}
}
