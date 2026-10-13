package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Restore requests, steps R0-R3 of SDS-BR-001 section 11.3: the request, the impact report, the approval by a different person, and
 * and rejection. There is no cancellation: a request is decided by the assigned approver. Nothing here restores data. An approved request is not executed by this slice: R4-R12 are not built.
 * The impact report is measured again at approval, because it changes while the system is in use (SDS 11.5.2 M4).
 */
@Service
public class RestoreRequestService {

    static final Set<String> TYPES = Set.of("R-FULL", "R-DB", "R-OBJ", "R-ONE");
    static final Set<String> TARGETS = Set.of("VALIDATION", "PRODUCTION");
    /** A production restore needs a test restore of the same backup that passed in the last 30 days (SDS 14.1). */
    /** The number of days (default 30) is an owner rule in restore_rule; see RestoreRules. */
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private static final ObjectMapper JSON = new ObjectMapper();

    public record Page(List<Map<String, Object>> data, int page, int limit, long total) {
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final BackupRepository repository;
    private final AgentProperties properties;
    private final RestoreRules rules;

    public RestoreRequestService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, BackupRepository repository, AgentProperties properties,
                                 RestoreRules rules) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.repository = repository;
        this.properties = properties;
        this.rules = rules;
    }

    // ------------------------------------------------------------------ reading

    private static final String SELECT = "select r.id, r.restore_number, b.backup_number, r.restore_type, r.target, r.status, r.reason, r.change_control_ref, r.requested_by, r.requested_at, "
            + "r.impact_sha256, r.impact_json::text as impact, r.rehearsal_id, r.approved_by, r.approval_signature_ref, r.decided_at, r.decision_reason "
            + "from restore_request r join backup_run b on b.id = r.run_id";

    public Page page(String search, String status, String target, String sortBy, boolean ascending, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            where.append(" and r.status = ?");
            args.add(status.trim().toUpperCase(Locale.ROOT));
        }
        if (target != null && !target.isBlank()) {
            where.append(" and r.target = ?");
            args.add(target.trim().toUpperCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(r.restore_number) like ? or lower(b.backup_number) like ? or lower(r.requested_by) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 3; i++) args.add(like);
        }
        String column = switch (sortBy == null ? "" : sortBy) {
            case "status" -> "r.status";
            case "backupNumber" -> "b.backup_number";
            case "requestedBy" -> "r.requested_by";
            case "decidedAt" -> "r.decided_at";
            default -> "r.requested_at";
        };
        Long total = jdbc.queryForObject("select count(*) from restore_request r join backup_run b on b.id = r.run_id" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + where + " order by " + column + (ascending ? " asc" : " desc") + " nulls last, r.restore_number desc limit ? offset ?", pageArgs.toArray())
                .stream().map(RestoreRequestService::view).toList();
        return new Page(rows, safePage, safeLimit, total == null ? 0 : total);
    }

    public Map<String, Object> get(String restoreNumber) {
        Map<String, Object> out = jdbc.queryForList(SELECT + " where r.restore_number = ?", restoreNumber).stream().findFirst().map(RestoreRequestService::view)
                .orElseThrow(() -> ExportException.notFound("RESTORE_REQUEST_NOT_FOUND", "There is no restore request " + restoreNumber));
        List<Map<String, Object>> events = jdbc.queryForList("select e.event, e.by_user, e.at from restore_request_event e join restore_request r on r.id = e.request_id "
                + "where r.restore_number = ? order by e.id", restoreNumber).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("event", e.get("event"));
            m.put("by", e.get("by_user"));
            m.put("at", ((Timestamp) e.get("at")).toInstant().toString());
            return m;
        }).toList();
        out.put("events", events);
        return out;
    }

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", String.valueOf(row.get("id")));
        m.put("restoreNumber", row.get("restore_number"));
        m.put("backupNumber", row.get("backup_number"));
        m.put("type", row.get("restore_type"));
        m.put("target", row.get("target"));
        m.put("status", row.get("status"));
        m.put("reason", row.get("reason"));
        m.put("changeControlRef", row.get("change_control_ref"));
        m.put("requestedBy", row.get("requested_by"));
        m.put("requestedAt", instant(row.get("requested_at")));
        m.put("impactSha256", row.get("impact_sha256") == null ? null : String.valueOf(row.get("impact_sha256")).trim());
        m.put("impact", row.get("impact") == null ? null : parse(String.valueOf(row.get("impact"))));
        m.put("rehearsalId", row.get("rehearsal_id") == null ? null : String.valueOf(row.get("rehearsal_id")));
        m.put("approvedBy", row.get("approved_by"));
        m.put("approvalSignatureRef", row.get("approval_signature_ref"));
        m.put("decidedAt", instant(row.get("decided_at")));
        m.put("decisionReason", row.get("decision_reason"));
        return m;
    }

    private static Object parse(String json) {
        try {
            return JSON.readValue(json, Map.class);
        } catch (Exception e) {
            return json;
        }
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    // ------------------------------------------------------------------ R0-R1: the request and its impact report

    /**
     * The test restore that decides whether a production request may be asked for (SDS 14.1): the latest passed test restore of this
     * backup, if it finished within the last 30 days; otherwise null. Read on the server, so the form only shows the answer.
     */
    public Map<String, Object> readiness(String backupNumber) {
        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
        int days = rules.value(RestoreRules.REHEARSAL_MAX_AGE_DAYS);
        List<Map<String, Object>> recent = jdbc.queryForList("select h.rehearsal_id, h.finished_at from restore_rehearsal h where h.run_id = ? and h.status = 'PASSED' "
                + "and h.finished_at > now() - make_interval(days => ?) order by h.finished_at desc limit 1", run.get("id"), days);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("backupNumber", backupNumber);
        out.put("maxAgeDays", days);
        if (recent.isEmpty()) {
            out.put("testRestore", null);
        } else {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("rehearsalId", recent.get(0).get("rehearsal_id"));
            row.put("finishedAt", String.valueOf(recent.get(0).get("finished_at")));
            out.put("testRestore", row);
        }
        return out;
    }

    public Map<String, Object> request(String backupNumber, String type, String target, String reason, String changeControlRef, String by) {
        String who = person(by);
        String kind = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        if (!TYPES.contains(kind)) throw ExportException.invalid("RESTORE_TYPE", "The restore type must be one of " + TYPES);
        String where = target == null ? "" : target.trim().toUpperCase(Locale.ROOT);
        if (!TARGETS.contains(where)) throw ExportException.invalid("RESTORE_TARGET", "The target must be VALIDATION or PRODUCTION");
        String why = required(reason, 500, "RESTORE_REASON_REQUIRED", "A reason is required (at most 500 characters)");
        String change = changeControlRef == null || changeControlRef.isBlank() ? null : changeControlRef.trim();
        if (change != null && change.length() > 120) throw ExportException.invalid("RESTORE_CHANGE_REF", "The change control reference is too long");

        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
        if (!"COMPLETED".equals(run.get("status"))) throw ExportException.conflict("RESTORE_BACKUP_NOT_COMPLETED", "Only a completed backup can be restored");
        String latest = jdbc.queryForList("select result from backup_verification where run_id = ? order by verified_at desc limit 1", String.class, run.get("id")).stream().findFirst().orElse("NOT_VERIFIED");
        if (!"VERIFIED".equals(latest)) throw ExportException.conflict("RESTORE_BACKUP_NOT_VERIFIED", "Only a backup whose latest integrity check passed can be restored");

        UUID rehearsal = null;
        if ("PRODUCTION".equals(where)) {
            rehearsal = jdbc.queryForList("select h.id from restore_rehearsal h where h.run_id = ? and h.status = 'PASSED' and h.finished_at > now() - make_interval(days => ?) "
                    + "order by h.finished_at desc limit 1", UUID.class, run.get("id"), rules.value(RestoreRules.REHEARSAL_MAX_AGE_DAYS)).stream().findFirst().orElse(null);
            if (rehearsal == null) {
                throw ExportException.conflict("RESTORE_REHEARSAL_REQUIRED", "A production restore needs a test restore of this backup that passed in the last 30 days");
            }
        }

        Map<String, Object> impact = impact((UUID) run.get("id"), backupNumber, by);
        String impactJson = CanonicalJson.of(impact);
        String impactSha = ManifestService.sha256(impactJson);
        final UUID rehearsalRef = rehearsal;
        try {
            String restoreNumber = tx.execute(s -> {
                Long seq = jdbc.queryForObject("select nextval('restore_request_seq')", Long.class);
                String id = "RS-" + DAY.format(Instant.now()) + "-" + String.format("%04d", seq);
                UUID row = jdbc.queryForObject("insert into restore_request(restore_number, run_id, restore_type, target, status, reason, change_control_ref, requested_by, impact_json, impact_sha256, rehearsal_id) "
                                + "values (?,?,?,?,'PENDING_APPROVAL',?,?,?,?::jsonb,?,?) returning id",
                        UUID.class, id, run.get("id"), kind, where, why, change, who, impactJson, impactSha, rehearsalRef);
                event(row, "REQUESTED", who, Map.of("type", kind, "target", where, "impactSha256", impactSha));
                return id;
            });
            ledger.append(who, "RESTORE_REQUESTED", backupNumber, Map.of("restoreNumber", restoreNumber, "type", kind, "target", where, "impactSha256", impactSha));
            return get(restoreNumber);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("RESTORE_ALREADY_OPEN", "A restore request for this backup is already waiting for approval");
        }
    }

    /**
     * What this restore would do, measured from the manifest and from the live eQMS database through the read-only account. Rows written
     * after the backup would be lost by a restore; they are counted, not guessed. If the live database cannot be read, the count is
     * recorded as not measured, with the reason, and the request is still possible: the approver sees it.
     */
    Map<String, Object> impact(UUID runId, String backupNumber, String by) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("backupNumber", backupNumber);
        out.put("measuredAt", Instant.now().toString());
        out.put("measuredBy", by == null ? "system" : by);
        JsonNode manifest;
        try {
            String text = jdbc.queryForObject("select manifest_text from backup_manifest where run_id = ?", String.class, runId);
            manifest = JSON.readTree(text);
        } catch (Exception e) {
            throw ExportException.conflict("RESTORE_MANIFEST_MISSING", "The manifest of this backup is not recorded");
        }
        out.put("dbSnapshotAt", manifest.path("dbSnapshotAt").asText(null));
        out.put("schemaVersion", manifest.path("app").path("flywayLatest").asText(null));
        List<Map<String, Object>> components = new ArrayList<>();
        long rows = 0;
        for (JsonNode c : manifest.path("components")) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", c.path("key").asText());
            m.put("sizeBytes", c.path("sizeBytes").asLong());
            m.put("objectCount", c.has("versionCount") ? c.path("versionCount").asLong() : null);
            if (c.has("rowCounts")) {
                long sum = 0;
                Iterator<JsonNode> counts = c.path("rowCounts").elements();
                while (counts.hasNext()) sum += counts.next().asLong();
                m.put("rows", sum);
                rows += sum;
            }
            components.add(m);
        }
        out.put("components", components);
        out.put("rowsInBackup", rows);
        out.put("targets", repository.locationsFor(runId).stream().map(l -> Map.of("target", l.get("target_code"), "ok", l.get("ok"))).toList());
        out.put("liveRowsAfterBackup", liveRowsAfter(manifest.path("dbSnapshotAt").asText(null)));
        return out;
    }

    /** Audit rows written in the live database after the backup was taken: what a restore would lose. Null when it cannot be measured. */
    private Map<String, Object> liveRowsAfter(String snapshotAt) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (snapshotAt == null) {
            out.put("measured", false);
            out.put("reason", "the backup has no snapshot time");
            return out;
        }
        AgentProperties.Source s = properties.getSource();
        String url = "jdbc:postgresql://" + s.getHost() + ":" + s.getPort() + "/" + s.getDatabase();
        try (Connection c = DriverManager.getConnection(url, s.getUser(), s.getPassword());
             PreparedStatement ps = c.prepareStatement("select count(*) from audit_logs where created_at > ?")) {
            ps.setTimestamp(1, Timestamp.from(Instant.parse(snapshotAt)));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                out.put("measured", true);
                out.put("auditRows", rs.getLong(1));
                out.put("note", "audit rows that a restore to this backup would remove; other tables are not counted yet");
            }
        } catch (SQLException e) {
            out.put("measured", false);
            out.put("reason", "the live database could not be read: " + e.getMessage());
        }
        return out;
    }

    // ------------------------------------------------------------------ R3: approval and rejection

    public Map<String, Object> approve(String restoreNumber, String by, String signatureRef) {
        String approver = person(by);
        String ref = required(signatureRef, 120, "RESTORE_SIGNATURE_REQUIRED", "An electronic signature is required to approve a restore");
        Map<String, Object> request = get(restoreNumber);
        requirePending(request);
        if (approver.equalsIgnoreCase((String) request.get("requestedBy"))) {
            ledger.append(approver, "RESTORE_APPROVAL_REFUSED", (String) request.get("backupNumber"), Map.of("restoreNumber", restoreNumber, "reason", "SAME_PERSON"));
            throw new ExportException(ExportException.Kind.SEPARATION, "RESTORE_SAME_PERSON", "The person who requested a restore cannot approve it");
        }
        UUID runId = jdbc.queryForObject("select r.run_id from restore_request r where r.restore_number = ?", UUID.class, restoreNumber);
        String backupNumber = (String) request.get("backupNumber");
        // R4 prerequisite: the impact is measured again now, because the live system has changed since the request
        Map<String, Object> impact = impact(runId, backupNumber, approver);
        String impactJson = CanonicalJson.of(impact);
        String impactSha = ManifestService.sha256(impactJson);
        tx.executeWithoutResult(s -> {
            int changed = jdbc.update("update restore_request set status = 'APPROVED', approved_by = ?, approval_signature_ref = ?, decided_at = now(), "
                    + "impact_json = ?::jsonb, impact_sha256 = ? where restore_number = ? and status = 'PENDING_APPROVAL'", approver, ref, impactJson, impactSha, restoreNumber);
            if (changed != 1) throw ExportException.conflict("RESTORE_STATE", "The request changed while it was approved; reload and try again");
            UUID row = jdbc.queryForObject("select id from restore_request where restore_number = ?", UUID.class, restoreNumber);
            event(row, "APPROVED", approver, Map.of("signatureRef", ref, "impactSha256", impactSha, "previousImpactSha256", request.get("impactSha256")));
        });
        ledger.append(approver, "RESTORE_APPROVED", backupNumber, Map.of("restoreNumber", restoreNumber, "impactSha256", impactSha, "signatureRef", ref));
        return get(restoreNumber);
    }

    public Map<String, Object> reject(String restoreNumber, String by, String reason) {
        String rejecter = person(by);
        String why = required(reason, 500, "RESTORE_REASON_REQUIRED", "A reason is required");
        Map<String, Object> request = get(restoreNumber);
        requirePending(request);
        if (rejecter.equalsIgnoreCase((String) request.get("requestedBy"))) {
            throw new ExportException(ExportException.Kind.SEPARATION, "RESTORE_SAME_PERSON", "The person who requested a restore cannot decide on it");
        }
        decide(restoreNumber, "REJECTED", rejecter, why, "RESTORE_REJECTED");
        return get(restoreNumber);
    }

    private void decide(String restoreNumber, String status, String by, String reason, String ledgerEvent) {
        tx.executeWithoutResult(s -> {
            int changed = jdbc.update("update restore_request set status = ?, decided_at = now(), decision_reason = ? where restore_number = ? and status = 'PENDING_APPROVAL'",
                    status, reason, restoreNumber);
            if (changed != 1) throw ExportException.conflict("RESTORE_STATE", "The request is no longer waiting for a decision");
            UUID row = jdbc.queryForObject("select id from restore_request where restore_number = ?", UUID.class, restoreNumber);
            event(row, status, by, Map.of("reason", reason));
        });
        String backupNumber = jdbc.queryForObject("select b.backup_number from restore_request r join backup_run b on b.id = r.run_id where r.restore_number = ?", String.class, restoreNumber);
        ledger.append(by, ledgerEvent, backupNumber, Map.of("restoreNumber", restoreNumber, "reason", reason));
    }

    private void requirePending(Map<String, Object> request) {
        if (!"PENDING_APPROVAL".equals(request.get("status"))) {
            throw ExportException.conflict("RESTORE_STATE", "The request is " + request.get("status") + ", not waiting for a decision");
        }
    }

    private void event(UUID requestRow, String event, String by, Map<String, ?> detail) {
        jdbc.update("insert into restore_request_event(request_id, event, by_user, detail_json) values (?,?,?,?::jsonb)", requestRow, event, by, CanonicalJson.of(detail));
    }

    private static String person(String by) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is doing this must be known");
        return by.trim();
    }

    private static String required(String value, int max, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty() || t.length() > max) throw ExportException.invalid(code, message);
        return t;
    }
}
