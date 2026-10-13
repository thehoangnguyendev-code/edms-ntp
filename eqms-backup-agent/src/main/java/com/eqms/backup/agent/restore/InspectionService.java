package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Backup Inspection, phase 1 (SDS-BR-001 section 7.2). A completed, verified backup is restored into a scratch database named
 * {@code inspect_{id}}, which is open for five minutes and then dropped by the agent. The inspection is read-only in three ways:
 * the database refuses default writes, the account the checks use has SELECT and nothing else, and the checks run a write probe
 * that must be refused. Phase 1 checks the database with queries only; no application runs against the copy.
 * Asking and approving are separate people; approval needs an electronic signature. Every step is recorded in the ledger.
 */
@Service
public class InspectionService {

    private static final Logger log = LoggerFactory.getLogger(InspectionService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    /** The copy is open this long, then the agent drops it (SDS 7.2, decided 10/10/2026). */
    public static final Duration OPEN_FOR = Duration.ofMinutes(5);
    static final String DB_PREFIX = "inspect_";
    /** Close reason of a failed copy that could not be dropped; the restore worker retries it. */
    static final String NOT_DROPPED = "OPEN_FAILED_NOT_DROPPED";
    /**
     * The read-only role the checks run as. A database administrator creates it once (scripts/backup/inspection-reader-role.sql): NOLOGIN,
     * no privileges of its own. The agent's account is a member and switches to it with SET ROLE, so the checks cannot write even
     * though that account owns the copy. The agent's account has no CREATEROLE, so it cannot create the role for each copy.
     */
    static final String READER_ROLE = "eqms_inspect_reader";
    private static final String SELECT = "select i.id, i.inspection_number, b.backup_number, i.status, i.reason, i.requested_by, i.requested_at, i.approved_by, "
            + "i.approval_signature_ref, i.decided_at, i.decision_reason, i.scratch_db, i.opened_at, i.expires_at, i.closed_at, i.closed_by, i.close_reason, "
            + "i.error_code, i.error_detail from backup_inspection i join backup_run b on b.id = i.run_id";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final BackupRepository repository;
    private final JobQueue queue;
    private final ManifestService manifests;
    private final CommandRunner runner;
    private final RestoreKeyring keyring;
    private final AgentProperties properties;

    public InspectionService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, BackupRepository repository, JobQueue queue,
                             ManifestService manifests, CommandRunner runner, RestoreKeyring keyring, AgentProperties properties) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.repository = repository;
        this.queue = queue;
        this.manifests = manifests;
        this.runner = runner;
        this.keyring = keyring;
        this.properties = properties;
    }

    // ------------------------------------------------------------------ reading

    /** A page of inspections, newest first, with an optional status filter. Paging is done here, not in the browser. */
    public Map<String, Object> page(String search, String status, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            where.append(" and i.status = ?");
            args.add(status.trim().toUpperCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(i.inspection_number) like ? or lower(b.backup_number) like ? or lower(i.requested_by) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 3; i++) args.add(like);
        }
        Long total = jdbc.queryForObject("select count(*) from backup_inspection i join backup_run b on b.id = i.run_id" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + where + " order by i.requested_at desc, i.inspection_number desc limit ? offset ?", pageArgs.toArray())
                .stream().map(InspectionService::view).toList();
        long count = total == null ? 0 : total;
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", safePage);
        pagination.put("limit", safeLimit);
        pagination.put("total", count);
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(count / (double) safeLimit)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", rows);
        out.put("pagination", pagination);
        return out;
    }

    public Map<String, Object> get(String inspectionNumber) {
        Map<String, Object> out = jdbc.queryForList(SELECT + " where i.inspection_number = ?", inspectionNumber).stream().findFirst().map(InspectionService::view)
                .orElseThrow(() -> ExportException.notFound("INSPECTION_NOT_FOUND", "There is no inspection " + inspectionNumber));
        UUID id = UUID.fromString(String.valueOf(out.get("id")));
        out.put("events", jdbc.queryForList("select event, by_user, at from backup_inspection_event where inspection_id = ? order by id", id).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("event", e.get("event"));
            m.put("by", e.get("by_user"));
            m.put("at", ((Timestamp) e.get("at")).toInstant().toString());
            return m;
        }).toList());
        out.put("checks", jdbc.queryForList("select code, title, required, ok, detail from backup_inspection_check where inspection_id = ? order by id", id).stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", c.get("code"));
            m.put("title", c.get("title"));
            m.put("required", c.get("required"));
            m.put("ok", c.get("ok"));
            m.put("detail", c.get("detail"));
            return m;
        }).toList());
        return out;
    }

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", String.valueOf(row.get("id")));
        m.put("inspectionNumber", row.get("inspection_number"));
        m.put("backupNumber", row.get("backup_number"));
        m.put("status", row.get("status"));
        m.put("reason", row.get("reason"));
        m.put("requestedBy", row.get("requested_by"));
        m.put("requestedAt", instant(row.get("requested_at")));
        m.put("approvedBy", row.get("approved_by"));
        m.put("approvalSignatureRef", row.get("approval_signature_ref"));
        m.put("decidedAt", instant(row.get("decided_at")));
        m.put("decisionReason", row.get("decision_reason"));
        m.put("scratchDb", row.get("scratch_db"));
        m.put("openedAt", instant(row.get("opened_at")));
        m.put("expiresAt", instant(row.get("expires_at")));
        m.put("closedAt", instant(row.get("closed_at")));
        m.put("closedBy", row.get("closed_by"));
        m.put("closeReason", row.get("close_reason"));
        m.put("errorCode", row.get("error_code"));
        m.put("errorDetail", row.get("error_detail"));
        return m;
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    // ------------------------------------------------------------------ asking and deciding (API process)

    public Map<String, Object> request(String backupNumber, String by, String reason) {
        String who = person(by);
        String why = required(reason, 500, "INSPECTION_REASON_REQUIRED", "A reason is required (at most 500 characters)");
        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
        if (!"COMPLETED".equals(run.get("status"))) throw ExportException.conflict("INSPECTION_BACKUP_NOT_COMPLETED", "Only a completed backup can be inspected");
        String latest = jdbc.queryForList("select result from backup_verification where run_id = ? order by verified_at desc limit 1", String.class, run.get("id")).stream().findFirst().orElse("NOT_VERIFIED");
        if (!"VERIFIED".equals(latest)) throw ExportException.conflict("INSPECTION_BACKUP_NOT_VERIFIED", "Only a backup whose latest integrity check passed can be inspected");
        try {
            String id = tx.execute(s -> {
                Long seq = jdbc.queryForObject("select nextval('backup_inspection_seq')", Long.class);
                String inspectionNumber = "IS-" + DAY.format(Instant.now()) + "-" + String.format("%04d", seq);
                UUID row = jdbc.queryForObject("insert into backup_inspection(inspection_number, run_id, status, reason, requested_by) values (?,?,'PENDING_APPROVAL',?,?) returning id",
                        UUID.class, inspectionNumber, run.get("id"), why, who);
                event(row, "REQUESTED", who, Map.of("reason", why));
                return inspectionNumber;
            });
            ledger.append(who, "INSPECTION_REQUESTED", backupNumber, Map.of("inspectionNumber", id, "reason", why));
            return get(id);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("INSPECTION_BUSY", "Another inspection is already waiting for approval or open");
        }
    }

    /** Approval by a different person with an electronic signature; the approval queues the copy for the restore worker. */
    public Map<String, Object> approve(String inspectionNumber, String by, String signatureRef) {
        String approver = person(by);
        String ref = required(signatureRef, 120, "INSPECTION_SIGNATURE_REQUIRED", "An electronic signature is required to approve an inspection");
        Map<String, Object> row = get(inspectionNumber);
        requirePending(row);
        String backupNumber = (String) row.get("backupNumber");
        if (approver.equalsIgnoreCase((String) row.get("requestedBy"))) {
            ledger.append(approver, "INSPECTION_APPROVAL_REFUSED", backupNumber, Map.of("inspectionNumber", inspectionNumber, "reason", "SAME_PERSON"));
            throw new ExportException(ExportException.Kind.SEPARATION, "INSPECTION_SAME_PERSON", "The person who asked for an inspection cannot approve it");
        }
        tx.executeWithoutResult(s -> {
            int changed = jdbc.update("update backup_inspection set status = 'APPROVED', approved_by = ?, approval_signature_ref = ?, decided_at = now() "
                    + "where inspection_number = ? and status = 'PENDING_APPROVAL'", approver, ref, inspectionNumber);
            if (changed != 1) throw ExportException.conflict("INSPECTION_STATE", "The inspection changed while it was approved; reload and try again");
            UUID id = jdbc.queryForObject("select id from backup_inspection where inspection_number = ?", UUID.class, inspectionNumber);
            event(id, "APPROVED", approver, Map.of("signatureRef", ref));
            queue.enqueue("INSPECTION", CanonicalJson.of(Map.of("inspectionNumber", inspectionNumber)), approver);
        });
        ledger.append(approver, "INSPECTION_APPROVED", backupNumber, Map.of("inspectionNumber", inspectionNumber, "signatureRef", ref));
        return get(inspectionNumber);
    }

    public Map<String, Object> reject(String inspectionNumber, String by, String reason) {
        String rejecter = person(by);
        String why = required(reason, 500, "INSPECTION_REASON_REQUIRED", "A reason is required");
        Map<String, Object> row = get(inspectionNumber);
        requirePending(row);
        if (rejecter.equalsIgnoreCase((String) row.get("requestedBy"))) {
            throw new ExportException(ExportException.Kind.SEPARATION, "INSPECTION_SAME_PERSON", "The person who asked for an inspection cannot decide on it");
        }
        tx.executeWithoutResult(s -> {
            int changed = jdbc.update("update backup_inspection set status = 'REJECTED', decided_at = now(), decision_reason = ? "
                    + "where inspection_number = ? and status = 'PENDING_APPROVAL'", why, inspectionNumber);
            if (changed != 1) throw ExportException.conflict("INSPECTION_STATE", "The inspection is no longer waiting for a decision");
            UUID id = jdbc.queryForObject("select id from backup_inspection where inspection_number = ?", UUID.class, inspectionNumber);
            event(id, "REJECTED", rejecter, Map.of("reason", why));
        });
        ledger.append(rejecter, "INSPECTION_REJECTED", (String) row.get("backupNumber"), Map.of("inspectionNumber", inspectionNumber, "reason", why));
        return get(inspectionNumber);
    }

    // ------------------------------------------------------------------ opening (restore worker)

    /** Restores the approved backup into {@code inspect_{id}}, makes it read-only, runs the checks and leaves it open for five minutes. */
    public Map<String, Object> open(String inspectionNumber) {
        Map<String, Object> row = get(inspectionNumber);
        if (!"APPROVED".equals(row.get("status"))) {
            throw ExportException.conflict("INSPECTION_STATE", "The inspection is " + row.get("status") + ", not approved for opening");
        }
        String backupNumber = (String) row.get("backupNumber");
        UUID id = UUID.fromString(String.valueOf(jdbc.queryForObject("select id from backup_inspection where inspection_number = ?", UUID.class, inspectionNumber)));
        jdbc.update("update backup_inspection set status = 'OPENING' where id = ? and status = 'APPROVED'", id);
        ledger.append("inspection-worker", "INSPECTION_OPENING", backupNumber, Map.of("inspectionNumber", inspectionNumber));

        String scratch = scratchName(inspectionNumber);
        List<PostRestoreChecks.Result> checks = new ArrayList<>();
        boolean created = false;
        String errorCode = null;
        String errorDetail = null;
        try (RestoreKeyring.Session ring = openRing()) {
            requireReaderRole();
            Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> new Failure("INSPECTION_BACKUP_MISSING", "The backup is no longer recorded"));
            UUID runId = (UUID) run.get("id");
            Map<String, Object> manifestRow = jdbc.queryForList("select manifest_text, signature_base64 from backup_manifest where run_id = ?", runId).stream().findFirst()
                    .orElseThrow(() -> new Failure("INSPECTION_MANIFEST_MISSING", "The manifest is not recorded"));
            String manifestText = (String) manifestRow.get("manifest_text");
            boolean signed = manifests.signatureValid(manifestText, (String) manifestRow.get("signature_base64"));
            checks.add(new PostRestoreChecks.Result("MANIFEST_SIGNATURE", "The manifest is signed by the Backup Agent key", true, signed, signed ? "Signature valid" : "The signature does not verify"));
            if (!signed) throw new Failure("INSPECTION_MANIFEST_SIGNATURE", "The manifest signature does not verify");
            JsonNode manifest = JSON.readTree(manifestText);
            Path setDir = Path.of(jdbc.queryForObject("select path from backup_set_location where run_id = ? and target_code = 'T1'", String.class, runId));

            List<String> wanted = new ArrayList<>();
            manifest.path("encryption").path("encryptionKeyIds").forEach(n -> wanted.add(n.asText().toUpperCase(Locale.ROOT)));
            List<String> held = ring.secretKeyIds();
            boolean keyOk = wanted.stream().anyMatch(held::contains);
            checks.add(new PostRestoreChecks.Result("DECRYPTION_KEY", "The private key for this backup is available", true, keyOk,
                    keyOk ? "Key available" : "None of the keys this backup was encrypted to is in the restore key ring"));
            if (!keyOk) throw new Failure("RESTORE_KEY_UNAVAILABLE", "The restore key ring does not hold a key this backup was encrypted to");

            createDatabase(scratch);
            created = true;
            restoreDump(ring, setDir, scratch);
            checks.add(new PostRestoreChecks.Result("RESTORE_DATABASE", "The database dump decrypts and restores", true, true, "Restored into " + scratch));

            grantReadOnly(scratch);
            Instant snapshotAt = Instant.parse(manifest.path("dbSnapshotAt").asText());
            try (Connection db = DriverManager.getConnection(scratchUrl(scratch), properties.getRestore().getUser(), properties.getRestore().getPassword())) {
                try (Statement st = db.createStatement()) {
                    st.execute("set role \"" + READER_ROLE + "\"");
                }
                checks.addAll(PostRestoreChecks.run(db, manifest, snapshotAt));
                checks.add(writeProbe(db));
            }
        } catch (Failure f) {
            errorCode = f.code;
            errorDetail = f.getMessage();
        } catch (IOException | SQLException | RuntimeException e) {
            log.error("Inspection {} failed to open", inspectionNumber, e);
            errorCode = "INSPECTION_ERROR";
            errorDetail = e.getClass().getSimpleName() + ": " + e.getMessage();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            errorCode = "INSPECTION_INTERRUPTED";
            errorDetail = "The inspection was interrupted";
        }

        boolean allRequiredOk = checks.stream().filter(PostRestoreChecks.Result::required).allMatch(PostRestoreChecks.Result::ok);
        if (errorCode == null && !allRequiredOk) {
            errorCode = "INSPECTION_CHECK_FAILED";
            errorDetail = checks.stream().filter(c -> c.required() && !c.ok()).map(c -> c.code() + ": " + c.detail()).reduce((a, b) -> a + " | " + b).orElse("");
        }
        if (errorCode != null) {
            boolean dropped = teardown(scratch, created);
            String detail = errorDetail == null ? null : (errorDetail.length() > 4000 ? errorDetail.substring(0, 4000) : errorDetail);
            recordChecks(id, checks);
            // a copy that could not be dropped stays recorded as such, so that the restore worker retries it (retryUndropped)
            jdbc.update("update backup_inspection set status = 'FAILED', scratch_db = ?, closed_at = now(), close_reason = ?, error_code = ?, error_detail = ? where id = ?",
                    scratch, dropped ? "OPEN_FAILED" : NOT_DROPPED, errorCode, detail, id);
            ledger.append("inspection-worker", "INSPECTION_FAILED", backupNumber, Map.of("inspectionNumber", inspectionNumber, "code", errorCode, "scratchDropped", dropped));
            if (!dropped) {
                repository.insertAlert("HIGH", "INSPECTION_NOT_DROPPED", "The inspection copy " + scratch + " is still on the server and must be dropped", scratch);
            }
            return get(inspectionNumber);
        }

        Instant openedAt = Instant.now();
        Instant expiresAt = openedAt.plus(OPEN_FOR);
        recordChecks(id, checks);
        jdbc.update("update backup_inspection set status = 'OPEN', scratch_db = ?, opened_at = ?, expires_at = ? where id = ? and status = 'OPENING'",
                scratch, Timestamp.from(openedAt), Timestamp.from(expiresAt), id);
        ledger.append("inspection-worker", "INSPECTION_OPENED", backupNumber, Map.of("inspectionNumber", inspectionNumber, "scratchDb", scratch,
                "requestedBy", String.valueOf(row.get("requestedBy")), "approvedBy", String.valueOf(row.get("approvedBy")),
                "reason", String.valueOf(row.get("reason")), "expiresAt", expiresAt.toString()));
        return get(inspectionNumber);
    }

    /** The copy is read-only when the account that reads it cannot write: a write probe must be refused, and that is itself a check. */
    private PostRestoreChecks.Result writeProbe(Connection db) throws SQLException {
        try (Statement st = db.createStatement()) {
            st.execute("create table inspect_write_probe(x int)");
            return new PostRestoreChecks.Result("READ_ONLY", "The copy refuses writes", true, false, "A table could be created in the read-only copy");
        } catch (SQLException e) {
            return new PostRestoreChecks.Result("READ_ONLY", "The copy refuses writes", true, true, "Write refused (" + e.getSQLState() + ")");
        }
    }

    // ------------------------------------------------------------------ closing (restore worker, API for the requester)

    /** Drops the copy and records why. A failed drop is an alert and stays open, so the next sweep tries again. */
    public Map<String, Object> close(String inspectionNumber, String by, String reason) {
        String who = person(by);
        String why = reason == null || reason.isBlank() ? "CLOSED_BY_USER" : reason.trim();
        Map<String, Object> row = get(inspectionNumber);
        if (!"OPEN".equals(row.get("status"))) {
            throw ExportException.conflict("INSPECTION_STATE", "The inspection is " + row.get("status") + ", not open");
        }
        String scratch = (String) row.get("scratchDb");
        boolean dropped = teardown(scratch, true);
        UUID id = UUID.fromString(String.valueOf(jdbc.queryForObject("select id from backup_inspection where inspection_number = ?", UUID.class, inspectionNumber)));
        if (dropped) {
            jdbc.update("update backup_inspection set status = 'CLOSED', closed_at = now(), closed_by = ?, close_reason = ? where id = ? and status = 'OPEN'", who, why, id);
            ledger.append(who, "INSPECTION_CLOSED", (String) row.get("backupNumber"), Map.of("inspectionNumber", inspectionNumber, "reason", why, "scratchDb", scratch));
        } else {
            repository.insertAlert("HIGH", "INSPECTION_NOT_DROPPED", "The inspection copy " + scratch + " could not be dropped and stays open for the next sweep", scratch);
            ledger.append(who, "INSPECTION_DROP_FAILED", (String) row.get("backupNumber"), Map.of("inspectionNumber", inspectionNumber, "reason", why, "scratchDb", scratch));
        }
        return get(inspectionNumber);
    }

    /** Called by the restore worker: every open copy whose five minutes are over is dropped. Returns how many were closed. */
    public int expireDue() {
        List<String> due = jdbc.queryForList("select inspection_number from backup_inspection where status = 'OPEN' and expires_at <= now()", String.class);
        int closed = 0;
        for (String inspectionNumber : due) {
            Map<String, Object> out = close(inspectionNumber, "system:inspection-expiry", "EXPIRED");
            if ("CLOSED".equals(out.get("status"))) closed++;
        }
        return closed;
    }

    /**
     * Tries again to drop copies whose failed open could not be dropped (SDS 7.2). Returns how many were dropped now. A copy that
     * still cannot be dropped stays on the list and the alert stays open.
     */
    public int retryUndropped() {
        List<Map<String, Object>> left = jdbc.queryForList("select id, inspection_number, scratch_db from backup_inspection where close_reason = ?", NOT_DROPPED);
        int dropped = 0;
        for (Map<String, Object> row : left) {
            String scratch = (String) row.get("scratch_db");
            if (!teardown(scratch, true)) continue;
            UUID id = (UUID) row.get("id");
            jdbc.update("update backup_inspection set close_reason = 'OPEN_FAILED' where id = ? and close_reason = ?", id, NOT_DROPPED);
            ledger.append("inspection-worker", "INSPECTION_DROP_RETRIED", null, Map.of("inspectionNumber", String.valueOf(row.get("inspection_number")), "scratchDb", String.valueOf(scratch)));
            dropped++;
        }
        return dropped;
    }

    /** On the agent that is not the restore worker: an open copy whose time is long over means the restore worker is not running. */
    public void alertOverdue() {
        List<Map<String, Object>> overdue = jdbc.queryForList("select inspection_number, scratch_db from backup_inspection where status = 'OPEN' and expires_at < now() - interval '2 minutes'");
        for (Map<String, Object> row : overdue) {
            String ref = String.valueOf(row.get("inspection_number"));
            Integer recent = jdbc.queryForObject("select count(*) from backup_alert where code = 'INSPECTION_OVERDUE' and ref = ? and at > now() - interval '30 minutes'", Integer.class, ref);
            if (recent != null && recent > 0) continue;
            repository.insertAlert("HIGH", "INSPECTION_OVERDUE", "The inspection copy " + row.get("scratch_db") + " is past its five minutes and has not been dropped: the restore worker may be down", ref);
        }
    }

    /** Drops the copy. Its name is checked again before anything is dropped; the shared reader role is kept. */
    private boolean teardown(String scratch, boolean dbMayExist) {
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword()); Statement st = c.createStatement()) {
            if (dbMayExist && scratch != null) {
                requireInspectName(scratch);
                st.execute("drop database if exists \"" + scratch + "\" with (force)");
            }
            return true;
        } catch (SQLException e) {
            log.error("The inspection copy {} could not be dropped", scratch, e);
            return false;
        }
    }

    // ------------------------------------------------------------------ the copy

    /** The database name of an inspection: {@code inspect_} and the id, never the live database name. */
    String scratchName(String inspectionNumber) {
        String name = DB_PREFIX + suffix(inspectionNumber);
        requireInspectName(name);
        return name;
    }

    private static String suffix(String inspectionNumber) {
        return inspectionNumber.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "_");
    }

    private void requireInspectName(String name) {
        if (!name.matches("inspect_[a-z0-9_]{1,50}") || name.equalsIgnoreCase(properties.getSource().getDatabase())) {
            throw new IllegalStateException("Refusing inspection database name " + name);
        }
    }

    private String adminUrl() {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/postgres";
    }

    private String scratchUrl(String name) {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/" + name;
    }

    private void createDatabase(String name) throws SQLException {
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword()); Statement st = c.createStatement()) {
            st.execute("create database \"" + name + "\"");
        }
    }

    private void restoreDump(RestoreKeyring.Session ring, Path setDir, String scratch) throws IOException, InterruptedException, Failure {
        Path sink = Files.createTempFile("inspection-", ".out");
        Files.delete(sink);
        CommandRunner.PipelineResult restored = runner.pipelineToFile(List.of(
                ring.decrypt(setDir.resolve("database/eqms.dump.gpg")),
                new CommandRunner.Command(List.of(properties.getTools().getPgRestore(), "-h", properties.getRestore().getHost(), "-p", String.valueOf(properties.getRestore().getPort()),
                        "-U", properties.getRestore().getUser(), "-d", scratch, "--no-owner", "--exit-on-error"), Map.of("PGPASSWORD", properties.getRestore().getPassword()))),
                sink, 3 * 3600);
        Files.deleteIfExists(sink);
        if (!restored.ok()) throw new Failure("INSPECTION_RESTORE_FAILED", "The database could not be restored (exit codes " + restored.exitCodes() + "): " + restored.stderrTail());
    }

    /** The reader role gets SELECT on the copy and nothing else, and the copy's default is read-only. */
    private void grantReadOnly(String scratch) throws SQLException {
        try (Connection c = DriverManager.getConnection(scratchUrl(scratch), properties.getRestore().getUser(), properties.getRestore().getPassword()); Statement st = c.createStatement()) {
            st.execute("revoke connect on database \"" + scratch + "\" from public");
            st.execute("grant connect on database \"" + scratch + "\" to \"" + READER_ROLE + "\"");
            st.execute("grant usage on schema public to \"" + READER_ROLE + "\"");
            st.execute("grant select on all tables in schema public to \"" + READER_ROLE + "\"");
            st.execute("grant select on all sequences in schema public to \"" + READER_ROLE + "\"");
            st.execute("alter database \"" + scratch + "\" set default_transaction_read_only = on");
        }
    }

    private void recordChecks(UUID id, List<PostRestoreChecks.Result> checks) {
        for (PostRestoreChecks.Result c : checks) {
            jdbc.update("insert into backup_inspection_check(inspection_id, code, title, required, ok, detail) values (?,?,?,?,?,?)",
                    id, c.code(), c.title(), c.required(), c.ok(), c.detail());
        }
    }

    /** Refuses before anything is restored if the reader role was not provisioned: the copy would not be read-only. */
    private void requireReaderRole() throws Failure, SQLException {
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword());
             PreparedStatement ps = c.prepareStatement("select count(*) from pg_roles where rolname = ? and not rolcanlogin")) {
            ps.setString(1, READER_ROLE);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                if (rs.getLong(1) != 1) {
                    throw new Failure("INSPECTION_READER_ROLE_MISSING", "The read-only role " + READER_ROLE
                            + " is not provisioned; a database administrator must create it (scripts/backup/inspection-reader-role.sql)");
                }
            }
        }
    }

    private RestoreKeyring.Session openRing() throws Failure {
        try {
            return keyring.open();
        } catch (IOException e) {
            throw new Failure("RESTORE_KEY_UNAVAILABLE", e.getMessage());
        }
    }

    // ------------------------------------------------------------------ helpers

    private void requirePending(Map<String, Object> row) {
        if (!"PENDING_APPROVAL".equals(row.get("status"))) {
            throw ExportException.conflict("INSPECTION_STATE", "The inspection is " + row.get("status") + ", not waiting for a decision");
        }
    }

    private void event(UUID row, String event, String by, Map<String, ?> detail) {
        jdbc.update("insert into backup_inspection_event(inspection_id, event, by_user, detail_json) values (?,?,?,?::jsonb)", row, event, by, CanonicalJson.of(detail));
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

    private static final class Failure extends IOException {
        final String code;

        Failure(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
