package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The Word templates of the assessment forms (for example APD.0009) that Training Administration keeps as the source of a test or a checklist. A template is uploaded Disabled;
 * it is enabled for its document number only with the electronic signature of a person who administers Training, and the one that was enabled is disabled in the same step. A
 * template can be disabled again with a reason. A file never changes and is never deleted. A person who prepares an activity starts a test from the enabled template and edits it
 * in OnlyOffice (see TrainingAssessmentEditService).
 */
@Service
public class TrainingFormTemplateService {
    public static final String TYPE = "TRAINING_FORM_TEMPLATE";
    private static final Set<String> EXTENSIONS = Set.of("docx");
    private static final String AUDIT_ENTITY = "TRAINING_FORM_TEMPLATE";

    public record EnableRequest(String signatureToken, String reason) {}
    public record DisableRequest(String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingFileService files;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final com.eqms.service.OnlyOfficeDocumentEditService onlyOffice;

    public TrainingFormTemplateService(JdbcTemplate jdbc, TrainingAccess access, TrainingFileService files, ElectronicSignatureService signatures, AuditTrailService audit, com.eqms.service.OnlyOfficeDocumentEditService onlyOffice) {
        this.onlyOffice = onlyOffice;
        this.jdbc = jdbc;
        this.access = access;
        this.files = files;
        this.signatures = signatures;
        this.audit = audit;
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** The list of the Training Properties screen: searched, filtered by status, sorted and paged here. */
    @Transactional(readOnly = true)
    public Map<String, Object> page(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit) {
        return page(actor, search, status, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> page(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.annex.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (search != null && !search.isBlank()) {
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (lower(t.code) like ? escape '\\' or lower(t.title) like ? escape '\\' or lower(t.version_label) like ? escape '\\' or lower(coalesce(t.original_name,'')) like ? escape '\\' or lower(coalesce(t.remark,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        if (status != null && Set.of("ENABLED", "DISABLED").contains(status)) { where.append(" and t.status = ?"); args.add(status); }
        TrainingListFilter extra = new TrainingListFilter().equal("t.code", more.get("code"))
                .contains(more.get("uploadedBy"), "u.full_name").contains(more.get("enabledBy"), "a.full_name").contains(more.get("disabledBy"), "d.full_name")
                .timeRange("t.uploaded_at", more.get("uploadedFrom"), more.get("uploadedTo")).timeRange("t.activated_at", more.get("enabledFrom"), more.get("enabledTo"))
                .timeRange("t.disabled_at", more.get("disabledFrom"), more.get("disabledTo"));
        if ("YES".equals(more.get("everEnabled"))) extra.raw("t.activated_at is not null");
        else if ("NO".equals(more.get("everEnabled"))) extra.raw("t.activated_at is null");
        if ("NEWER_REVISION".equals(more.get("disableKind"))) extra.raw("t.status = 'DISABLED' and t.disable_reason = 'Another revision of the document was enabled'");
        else if ("MANUAL".equals(more.get("disableKind"))) extra.raw("t.status = 'DISABLED' and coalesce(t.disable_reason,'') <> 'Another revision of the document was enabled'");
        where.append(extra.and());
        args.addAll(extra.args());
        String from = " from training_form_templates t join app_users u on u.id = t.uploaded_by left join app_users a on a.id = t.activated_by left join app_users d on d.id = t.disabled_by";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select t.id, t.code, t.title, t.version_label, t.original_name, t.size_bytes, t.sha256, t.remark, t.status, t.uploaded_at, u.full_name as uploaded_by_name,
                   t.activated_at as enabled_at, a.full_name as enabled_by_name, t.disabled_at, d.full_name as disabled_by_name, t.disable_reason, t.source,
                   t.token_mode, t.check_problems, t.checked_at
            """ + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.ofEntries(Map.entry("code", "t.code"), Map.entry("title", "t.title"), Map.entry("version", "t.version_label"), Map.entry("status", "t.status"),
                Map.entry("uploadedBy", "u.full_name"), Map.entry("uploadedAt", "t.uploaded_at"), Map.entry("enabledAt", "t.activated_at"), Map.entry("enabledBy", "a.full_name"), Map.entry("disabledBy", "d.full_name"), Map.entry("disabledAt", "t.disabled_at"), Map.entry("disableReason", "t.disable_reason")), "t.code, t.uploaded_at desc") + " limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The current templates, for the person who prepares a test (the activity screen offers them as the starting point). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> current(UserAccount actor) {
        access.require(actor, "training.activity.organize", "training.annex.view");
        return TrainingRows.camel(jdbc.queryForList("select id, code, title, version_label, original_name, sha256, activated_at as enabled_at from training_form_templates where status = 'ENABLED' order by code"));
    }

    @Transactional
    public Map<String, Object> upload(UserAccount actor, MultipartFile file, String code, String title, String versionLabel, String remark) {
        access.require(actor, "training.annex.manage");
        if (code == null || !code.trim().matches("[A-Za-z0-9._-]{2,40}") || title == null || title.isBlank() || title.length() > 255
                || versionLabel == null || versionLabel.isBlank() || versionLabel.trim().length() > 40) throw new IllegalArgumentException("TRAINING_TEMPLATE_INVALID");
        String cleanCode = code.trim().toUpperCase(Locale.ROOT), cleanVersion = versionLabel.trim();
        if (!TrainingAnnexContract.codes().contains(cleanCode)) throw new IllegalArgumentException("TRAINING_TEMPLATE_INVALID");
        // the Revision Number is the one of the document in force in Document Control (1.0.0, 2.0.0): the code of the form is written from it (APD.0024.02)
        if (!TrainingAnnexContract.validRevision(cleanVersion)) throw new IllegalArgumentException("TRAINING_TEMPLATE_REVISION_INVALID");
        Integer same = jdbc.queryForObject("select count(*) from training_form_templates where code = ? and lower(version_label) = lower(?)", Integer.class, cleanCode, cleanVersion);
        if (same != null && same > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TEMPLATE_VERSION_EXISTS");
        UUID id = UUID.randomUUID();
        TrainingFileService.StoredFile stored = files.storeUpload(file, "training/form-templates/" + id, EXTENSIONS);
        TrainingAnnexCheck check;
        try {
            check = TrainingAnnexCheck.of(cleanCode, file.getBytes());
        } catch (java.io.IOException | RuntimeException e) {
            check = new TrainingAnnexCheck("TOKENS", List.of("the file cannot be read as a Word document"));
        }
        jdbc.update("""
            insert into training_form_templates(id, code, title, version_label, original_name, provider, stored_path, content_type, size_bytes, sha256, remark, uploaded_by, token_mode, check_problems, checked_at)
            values (?,?,?,?,?,?,?,?,?,?,?,?,?,?, now())
            """, id, cleanCode, title.trim(), cleanVersion, stored.name(), stored.provider(), stored.path(), stored.contentType(), stored.size(), stored.sha256(),
                remark == null || remark.isBlank() ? null : remark.trim(), actor.getId(), check.mode(), check.problems().isEmpty() ? null : String.join("\n", check.problems()));
        audit.logAs(actor, AUDIT_ENTITY, AUDIT_ENTITY, id, "TRAINING_FORM_TEMPLATE_UPLOADED", null, "DISABLED",
                cleanCode + " " + cleanVersion + " (SHA-256 " + stored.sha256().substring(0, 12) + "); " + check.summary());
        return one(id);
    }

    /** Enables a template for its document number. Electronic signature; the one that was enabled is disabled in the same transaction. */
    @Transactional
    public Map<String, Object> enable(UserAccount actor, UUID id, EnableRequest request) {
        access.require(actor, "training.annex.enable");
        Map<String, Object> t = lock(id);
        if ("ENABLED".equals(t.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TEMPLATE_ALREADY_ENABLED");
        // a template written with tokens that does not agree with the contract of its form is never put in force; an earlier template (no tokens) is, and says so
        if ("TOKENS".equals(t.get("token_mode")) && t.get("check_problems") != null && !String.valueOf(t.get("check_problems")).isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TEMPLATE_CHECK_FAILED");
        }
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        String label = t.get("code") + " " + t.get("version_label");
        UUID signature = signatures.createEntitySignature(TYPE, id, label, actor, request.signatureToken(), "TRAINING_FORM_TEMPLATE_ENABLED", request.reason().trim(), null, null, null).getId();
        jdbc.update("update training_form_templates set status = 'DISABLED', disabled_by = ?, disabled_at = now(), disable_reason = 'Another revision of the document was enabled' where code = ? and status = 'ENABLED'", actor.getId(), t.get("code"));
        jdbc.update("update training_form_templates set status = 'ENABLED', activated_by = ?, activated_at = now(), activate_signature_id = ?, disabled_by = null, disabled_at = null, disable_reason = null where id = ?", actor.getId(), signature, id);
        audit.logAs(actor, AUDIT_ENTITY, AUDIT_ENTITY, id, "TRAINING_FORM_TEMPLATE_ENABLED", "DISABLED", "ENABLED", label + ": " + request.reason().trim());
        return one(id);
    }

    /** Takes a template out of use. A test that was started from it keeps its own file. A reason is needed and is recorded. */
    @Transactional
    public Map<String, Object> disable(UserAccount actor, UUID id, DisableRequest request) {
        access.require(actor, "training.annex.manage");
        Map<String, Object> t = lock(id);
        if (!"ENABLED".equals(t.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TEMPLATE_NOT_ENABLED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_form_templates set status = 'DISABLED', disabled_by = ?, disabled_at = now(), disable_reason = ? where id = ?", actor.getId(), request.reason().trim(), id);
        audit.logAs(actor, AUDIT_ENTITY, AUDIT_ENTITY, id, "TRAINING_FORM_TEMPLATE_DISABLED", "ENABLED", "DISABLED", t.get("code") + " " + t.get("version_label") + ": " + request.reason().trim());
        return one(id);
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_form_templates where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    /** The Word file of a template, for the administrator and for the person who prepares a test. */
    @Transactional(readOnly = true)
    public Map<String, Object> download(UserAccount actor, UUID id) {
        access.require(actor, "training.annex.view", "training.activity.organize");
        Map<String, Object> t = jdbc.queryForList("select * from training_form_templates where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        // Only an enabled template is offered to the person who prepares a test; the others are for the administrator.
        if (!"ENABLED".equals(t.get("status")) && !access.has(actor, "training.annex.view")) throw new SecurityException(TrainingAccess.DENIED);
        byte[] bytes = files.readStored(String.valueOf(t.get("provider")), String.valueOf(t.get("stored_path")), String.valueOf(t.get("sha256")));
        return Map.of("bytes", bytes, "contentType", String.valueOf(t.get("content_type")), "name", String.valueOf(t.get("original_name")));
    }

    /** The read-only OnlyOffice viewer configuration of a template, for the administrator and for the person who prepares a test. */
    @Transactional(readOnly = true)
    public Map<String, Object> viewConfig(UserAccount actor, UUID id) {
        access.require(actor, "training.annex.view", "training.activity.organize");
        Map<String, Object> t = jdbc.queryForList("select * from training_form_templates where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"ENABLED".equals(t.get("status")) && !access.has(actor, "training.annex.view")) throw new SecurityException(TrainingAccess.DENIED);
        if (!onlyOffice.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_PREVIEW_UNAVAILABLE");
        return new LinkedHashMap<>(com.fasterxml.jackson.databind.json.JsonMapper.builder().build().convertValue(
                onlyOffice.buildStoredFileViewConfig("training-form-template", id, String.valueOf(t.get("sha256")), String.valueOf(t.get("original_name")), actor), Map.class));
    }

    /** The bytes the document server fetches for the viewer (authenticated by its token, not by a session); the SHA-256 is checked. */
    @Transactional(readOnly = true)
    public byte[] bytesForViewer(UUID id) {
        Map<String, Object> t = jdbc.queryForList("select * from training_form_templates where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        return files.readStored(String.valueOf(t.get("provider")), String.valueOf(t.get("stored_path")), String.valueOf(t.get("sha256")));
    }

    private Map<String, Object> one(UUID id) {
        return TrainingRows.camel(jdbc.queryForList("""
            select t.id, t.code, t.title, t.version_label, t.original_name, t.size_bytes, t.sha256, t.remark, t.status, t.uploaded_at, u.full_name as uploaded_by_name,
                   t.activated_at as enabled_at, a.full_name as enabled_by_name, t.disabled_at, d.full_name as disabled_by_name, t.disable_reason, t.source,
                   t.token_mode, t.check_problems, t.checked_at
              from training_form_templates t join app_users u on u.id = t.uploaded_by left join app_users a on a.id = t.activated_by left join app_users d on d.id = t.disabled_by where t.id = ?
            """, id).getFirst());
    }
}
