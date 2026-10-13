package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.objects.TestObjectStore;
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
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
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
 * Restore rehearsal (SDS 14.1, V2/V3). A backup is decrypted and restored into a scratch database, the checks that can be run on
 * a restored database are run, every stored document is decrypted and compared with the SHA-256 recorded when it was stored, and
 * the scratch database is dropped. Production is never touched: the scratch database has its own name, is created by a role that
 * owns nothing else, and the name can never be the live one. The API process only queues the work; the restore worker, the only
 * process that holds the private key, does it.
 */
@Service
public class RestoreRehearsalService {

    private static final Logger log = LoggerFactory.getLogger(RestoreRehearsalService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    public record Page(List<Map<String, Object>> data, int page, int limit, long total) {
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final BackupRepository repository;
    private final JobQueue queue;
    private final ManifestService manifests;
    private final CommandRunner runner;
    private final RestoreKeyring keyring;
    private final AgentProperties properties;
    private final TestObjectStore testStore;

    public RestoreRehearsalService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, BackupRepository repository, JobQueue queue,
                                   ManifestService manifests, CommandRunner runner, RestoreKeyring keyring, AgentProperties properties,
                                   TestObjectStore testStore) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.repository = repository;
        this.queue = queue;
        this.manifests = manifests;
        this.runner = runner;
        this.keyring = keyring;
        this.properties = properties;
        this.testStore = testStore;
    }

    // ------------------------------------------------------------------ reading

    private static final String SELECT = "select h.id, h.rehearsal_id, r.backup_number, h.status, h.requested_by, h.reason, h.requested_at, h.started_at, h.finished_at, h.scratch_db, "
            + "h.restore_seconds, h.error_code, h.error_detail, (select count(*) from restore_rehearsal_check k where k.rehearsal_id = h.id) as check_count, "
            + "(select count(*) from restore_rehearsal_check k where k.rehearsal_id = h.id and not k.ok) as failed_count "
            + "from restore_rehearsal h join backup_run r on r.id = h.run_id";

    public Page page(String search, String status, String backupNumber, String sortBy, boolean ascending, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            where.append(" and h.status = ?");
            args.add(status.trim().toUpperCase(Locale.ROOT));
        }
        if (backupNumber != null && !backupNumber.isBlank()) {
            where.append(" and r.backup_number = ?");
            args.add(backupNumber.trim());
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(h.rehearsal_id) like ? or lower(r.backup_number) like ? or lower(h.requested_by) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 3; i++) args.add(like);
        }
        String column = switch (sortBy == null ? "" : sortBy) {
            case "status" -> "h.status";
            case "backupNumber" -> "r.backup_number";
            case "requestedBy" -> "h.requested_by";
            case "finishedAt" -> "h.finished_at";
            default -> "h.requested_at";
        };
        Long total = jdbc.queryForObject("select count(*) from restore_rehearsal h join backup_run r on r.id = h.run_id" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + where + " order by " + column + (ascending ? " asc" : " desc") + " nulls last, h.rehearsal_id desc limit ? offset ?", pageArgs.toArray())
                .stream().map(RestoreRehearsalService::view).toList();
        return new Page(rows, safePage, safeLimit, total == null ? 0 : total);
    }

    public Map<String, Object> get(String rehearsalId) {
        Map<String, Object> row = jdbc.queryForList(SELECT + " where h.rehearsal_id = ?", rehearsalId).stream().findFirst().map(RestoreRehearsalService::view)
                .orElseThrow(() -> ExportException.notFound("REHEARSAL_NOT_FOUND", "There is no rehearsal " + rehearsalId));
        List<Map<String, Object>> checks = jdbc.queryForList("select code, title, required, ok, detail, checked_at from restore_rehearsal_check where rehearsal_id = ?::uuid order by id", row.get("id")).stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", c.get("code"));
            m.put("title", c.get("title"));
            m.put("required", c.get("required"));
            m.put("ok", c.get("ok"));
            m.put("detail", c.get("detail"));
            m.put("checkedAt", ((Timestamp) c.get("checked_at")).toInstant().toString());
            return m;
        }).toList();
        row.put("checks", checks);
        return row;
    }

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", String.valueOf(row.get("id")));
        m.put("rehearsalId", row.get("rehearsal_id"));
        m.put("backupNumber", row.get("backup_number"));
        m.put("status", row.get("status"));
        m.put("requestedBy", row.get("requested_by"));
        m.put("reason", row.get("reason"));
        m.put("requestedAt", instant(row.get("requested_at")));
        m.put("startedAt", instant(row.get("started_at")));
        m.put("finishedAt", instant(row.get("finished_at")));
        m.put("scratchDb", row.get("scratch_db"));
        m.put("restoreSeconds", row.get("restore_seconds"));
        m.put("errorCode", row.get("error_code"));
        m.put("errorDetail", row.get("error_detail"));
        m.put("checkCount", row.get("check_count"));
        m.put("failedCount", row.get("failed_count"));
        return m;
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    // ------------------------------------------------------------------ asking for one (API process)

    public Map<String, Object> request(String backupNumber, String by, String reason) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is asking must be known");
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty() || why.length() > 500) throw ExportException.invalid("REHEARSAL_REASON_REQUIRED", "A reason is required (at most 500 characters)");
        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
        if (!"COMPLETED".equals(run.get("status"))) throw ExportException.conflict("REHEARSAL_BACKUP_NOT_COMPLETED", "Only a completed backup can be test-restored");
        String latest = jdbc.queryForList("select result from backup_verification where run_id = ? order by verified_at desc limit 1", String.class, run.get("id")).stream().findFirst().orElse("NOT_VERIFIED");
        if (!"VERIFIED".equals(latest)) throw ExportException.conflict("REHEARSAL_BACKUP_NOT_VERIFIED", "Only a backup whose latest integrity check passed can be test-restored");
        try {
            String id = tx.execute(status -> {
                Long seq = jdbc.queryForObject("select nextval('restore_rehearsal_seq')", Long.class);
                String rehearsalId = "RH-" + DAY.format(Instant.now()) + "-" + String.format("%04d", seq);
                UUID row = jdbc.queryForObject("insert into restore_rehearsal(rehearsal_id, run_id, status, requested_by, reason) values (?,?,'QUEUED',?,?) returning id",
                        UUID.class, rehearsalId, run.get("id"), by.trim(), why);
                queue.enqueue("REHEARSAL", CanonicalJson.of(Map.of("rehearsalId", rehearsalId, "id", row.toString())), by.trim());
                return rehearsalId;
            });
            ledger.append(by.trim(), "RESTORE_REHEARSAL_REQUESTED", backupNumber, Map.of("rehearsalId", id));
            return get(id);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("REHEARSAL_BUSY", "Another restore test is already waiting or running");
        }
    }

    // ------------------------------------------------------------------ doing it (restore worker)

    public Map<String, Object> run(String rehearsalId) {
        Map<String, Object> rehearsal = get(rehearsalId);
        UUID id = UUID.fromString((String) rehearsal.get("id"));
        String backupNumber = (String) rehearsal.get("backupNumber");
        jdbc.update("update restore_rehearsal set status = 'RUNNING', started_at = now() where id = ? and status = 'QUEUED'", id);
        ledger.append("restore-worker", "RESTORE_REHEARSAL_STARTED", backupNumber, Map.of("rehearsalId", rehearsalId));
        List<PostRestoreChecks.Result> checks = new ArrayList<>();
        String scratch = scratchName(rehearsalId);
        boolean created = false;
        String testBucket = null;
        String errorCode = null;
        String errorDetail = null;
        long restoreSeconds = 0;
        try (RestoreKeyring.Session ring = openRing()) {
            Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> new Failure("REHEARSAL_BACKUP_MISSING", "The backup is no longer recorded"));
            UUID runId = (UUID) run.get("id");
            Map<String, Object> manifestRow = jdbc.queryForList("select manifest_text, manifest_sha256, signature_base64 from backup_manifest where run_id = ?", runId).stream().findFirst()
                    .orElseThrow(() -> new Failure("REHEARSAL_MANIFEST_MISSING", "The manifest is not recorded"));
            String manifestText = (String) manifestRow.get("manifest_text");
            boolean signed = manifests.signatureValid(manifestText, (String) manifestRow.get("signature_base64"));
            checks.add(new PostRestoreChecks.Result("MANIFEST_SIGNATURE", "The manifest is signed by the Backup Agent key", true, signed, signed ? "Signature valid" : "The signature does not verify"));
            if (!signed) throw new Failure("REHEARSAL_MANIFEST_SIGNATURE", "The manifest signature does not verify");
            JsonNode manifest = JSON.readTree(manifestText);
            Path setDir = Path.of(jdbc.queryForObject("select path from backup_set_location where run_id = ? and target_code = 'T1'", String.class, runId));
            Path envRoot = setDir.getParent().getParent().getParent();

            List<String> wanted = new ArrayList<>();
            manifest.path("encryption").path("encryptionKeyIds").forEach(n -> wanted.add(n.asText().toUpperCase(Locale.ROOT)));
            List<String> held = ring.secretKeyIds();
            boolean keyOk = wanted.stream().anyMatch(held::contains);
            checks.add(new PostRestoreChecks.Result("DECRYPTION_KEY", "The private key for this backup is available", true, keyOk,
                    keyOk ? "Key " + wanted.stream().filter(held::contains).findFirst().orElse("") : "None of the keys this backup was encrypted to is in the restore key ring"));
            if (!keyOk) throw new Failure("RESTORE_KEY_UNAVAILABLE", "The restore key ring does not hold a key this backup was encrypted to");

            createScratch(scratch);
            created = true;
            long started = System.nanoTime();
            Path sink = Files.createTempFile("rehearsal-", ".out");
            Files.delete(sink);
            CommandRunner.PipelineResult restored = runner.pipelineToFile(List.of(
                    ring.decrypt(setDir.resolve("database/eqms.dump.gpg")),
                    new CommandRunner.Command(List.of(properties.getTools().getPgRestore(), "-h", properties.getRestore().getHost(), "-p", String.valueOf(properties.getRestore().getPort()),
                            "-U", properties.getRestore().getUser(), "-d", scratch, "--no-owner", "--exit-on-error"), Map.of("PGPASSWORD", properties.getRestore().getPassword()))),
                    sink, 3 * 3600);
            Files.deleteIfExists(sink);
            restoreSeconds = Math.round((System.nanoTime() - started) / 1e9);
            checks.add(new PostRestoreChecks.Result("RESTORE_DATABASE", "The database dump decrypts and restores", true, restored.ok(),
                    restored.ok() ? "Restored in " + restoreSeconds + " s" : "gpg or pg_restore failed (exit codes " + restored.exitCodes() + "): " + restored.stderrTail()));
            if (!restored.ok()) throw new Failure("RESTORE_DATABASE_FAILED", "The database could not be restored");

            Instant snapshotAt = Instant.parse(manifest.path("dbSnapshotAt").asText());
            try (Connection db = DriverManager.getConnection(scratchUrl(scratch), properties.getRestore().getUser(), properties.getRestore().getPassword())) {
                checks.addAll(PostRestoreChecks.run(db, manifest, snapshotAt));
                objectChecks(ring, manifest, runId, envRoot, setDir, checks);
                // WP3.1 slice 4 (SDS 11.4.2, 14.3): the documents are written again into a throw-away bucket and their aliases recorded
                String prefix = properties.getRestore().getTestObjects().getBucketPrefix();
                testBucket = RestoreObjectRestore.bucketFor(prefix, rehearsalId);
                RestoreObjectRestore objects = new RestoreObjectRestore(testStore, runner, prefix);
                RestoreObjectRestore.Summary summary = objects.restore(testBucket, runId, repository, ring, envRoot, db);
                checks.addAll(objects.checks(db, summary));
                // SDS 14.3: signatures (C5), accounts (C8), schedulers (C9) and jobs (C10) of the restored copy
                // DEV only: a warning when the flag is set; the flag is ignored outside DEV
                boolean advisory = "DEV".equalsIgnoreCase(properties.getEnvironment()) && properties.getRestore().isSignatureCheckAdvisory();
                checks.add(objects.signatures(db, !advisory));
                checks.add(RestoreStateChecks.users(db));
                checks.add(RestoreStateChecks.schedulers(db));
                checks.add(RestoreStateChecks.jobs(db));
            }
            // C12: a warning about the services the restored copy depends on
            checks.add(RestoreStateChecks.dependencies(properties.getRestore().getDependencyEndpoints(), 3000));
        } catch (Failure f) {
            errorCode = f.code;
            errorDetail = f.getMessage();
        } catch (IOException | SQLException | RuntimeException e) {
            log.error("Rehearsal {} failed", rehearsalId, e);
            errorCode = "REHEARSAL_ERROR";
            errorDetail = e.getClass().getSimpleName() + ": " + e.getMessage();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            errorCode = "REHEARSAL_INTERRUPTED";
            errorDetail = "The restore test was interrupted";
        } finally {
            if (created) dropScratch(scratch);
            if (testBucket != null) removeTestBucket(testBucket);
        }

        boolean allRequiredOk = checks.stream().filter(PostRestoreChecks.Result::required).allMatch(PostRestoreChecks.Result::ok);
        boolean passed = errorCode == null && allRequiredOk;
        if (errorCode == null && !allRequiredOk) {
            errorCode = "REHEARSAL_CHECK_FAILED";
            errorDetail = checks.stream().filter(c -> c.required() && !c.ok()).map(c -> c.code() + ": " + c.detail()).reduce((a, b) -> a + " | " + b).orElse("");
        }
        List<PostRestoreChecks.Result> finalChecks = checks;
        String code = errorCode;
        String detail = errorDetail == null ? null : (errorDetail.length() > 4000 ? errorDetail.substring(0, 4000) : errorDetail);
        long seconds = restoreSeconds;
        tx.executeWithoutResult(s -> {
            for (PostRestoreChecks.Result c : finalChecks) {
                jdbc.update("insert into restore_rehearsal_check(rehearsal_id, code, title, required, ok, detail) values (?,?,?,?,?,?)", id, c.code(), c.title(), c.required(), c.ok(), c.detail());
            }
            jdbc.update("update restore_rehearsal set status = ?, finished_at = now(), scratch_db = ?, restore_seconds = ?, error_code = ?, error_detail = ? where id = ?",
                    passed ? "PASSED" : "FAILED", scratch, seconds, code, detail, id);
        });
        Map<String, Object> done = new LinkedHashMap<>();
        done.put("rehearsalId", rehearsalId);
        done.put("checks", checks.size());
        done.put("failed", checks.stream().filter(c -> !c.ok()).map(PostRestoreChecks.Result::code).toList());
        ledger.append("restore-worker", passed ? "RESTORE_REHEARSAL_PASSED" : "RESTORE_REHEARSAL_FAILED", backupNumber, done);
        if (!passed) {
            repository.insertAlert("HIGH", "RESTORE_REHEARSAL_FAILED", "The test restore " + rehearsalId + " of " + backupNumber + " failed: " + code, backupNumber);
        }
        if (WeeklyV2Verification.REQUESTER.equals(rehearsal.get("requestedBy"))) {
            recordV2(backupNumber, rehearsalId, passed, code);
        }
        return get(rehearsalId);
    }

    /** The outcome of a scheduled test restore is the V2 verification of its backup (SDS 14.1); a failure is recorded, never hidden. */
    private void recordV2(String backupNumber, String rehearsalId, boolean passed, String errorCode) {
        UUID runId = (UUID) repository.runByBackupNumber(backupNumber).orElseThrow().get("id");
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("rehearsalId", rehearsalId);
        detail.put("errorCode", errorCode == null ? "" : errorCode);
        jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) values (?, 'V2', ?, ?::jsonb, now(), ?)",
                runId, passed ? "VERIFIED" : "FAILED", CanonicalJson.of(detail), WeeklyV2Verification.REQUESTER);
    }

    /** Every stored document the backup holds must decrypt to exactly the bytes whose SHA-256 was recorded when it was stored. */
    private void objectChecks(RestoreKeyring.Session ring, JsonNode manifest, UUID runId, Path envRoot, Path setDir, List<PostRestoreChecks.Result> checks)
            throws IOException, InterruptedException {
        JsonNode store = null;
        for (JsonNode c : manifest.path("components")) {
            if ("OBJECT_STORE".equals(c.path("key").asText())) store = c;
        }
        if (store == null) return;
        List<String> problems = new ArrayList<>();
        int checked = 0;
        long bytes = 0;
        for (BackupRepository.Blob blob : repository.blobsUpTo(runId)) {
            CommandRunner.HashResult h = runner.hashOutput(ring.decrypt(envRoot.resolve(blob.path())), 600);
            checked++;
            bytes += h.bytes();
            if (!h.ok()) problems.add(blob.path() + " did not decrypt");
            else if (!h.sha256().equals(blob.plainSha256())) problems.add(blob.path() + " decrypts to different content");
            if (problems.size() >= 10) break;
        }
        boolean ok = problems.isEmpty();
        checks.add(new PostRestoreChecks.Result("C6", "Every stored document decrypts to its recorded SHA-256", true, ok,
                ok ? checked + " documents, " + bytes + " bytes, all match" : String.join("; ", problems)));

        CommandRunner.Result index = runner.run(ring.decrypt(setDir.resolve("objects/index.json.gpg")), 600);
        boolean indexOk = false;
        String indexDetail;
        if (!index.ok()) {
            indexDetail = "The document index did not decrypt";
        } else {
            JsonNode versions = JSON.readTree(index.stdout()).path("versions");
            long expected = store.path("versionCount").asLong(-1);
            indexOk = versions.size() == expected;
            indexDetail = indexOk ? versions.size() + " versions listed, as the manifest says" : "The index lists " + versions.size() + " versions but the manifest says " + expected;
        }
        checks.add(new PostRestoreChecks.Result("C6_INDEX", "The document index matches the manifest", true, indexOk, indexDetail));
    }

    // ------------------------------------------------------------------ the scratch database

    String scratchName(String rehearsalId) {
        String name = properties.getRestore().getDbPrefix() + rehearsalId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "_");
        if (!name.matches("[a-z][a-z0-9_]{5,62}") || !name.startsWith(properties.getRestore().getDbPrefix()) || name.equalsIgnoreCase(properties.getSource().getDatabase())) {
            throw new IllegalStateException("Refusing scratch database name " + name);
        }
        return name;
    }

    private String adminUrl() {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/postgres";
    }

    private String scratchUrl(String name) {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/" + name;
    }

    private void createScratch(String name) throws SQLException {
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword()); Statement st = c.createStatement()) {
            st.execute("create database \"" + name + "\"");
        }
    }

    private void removeTestBucket(String bucket) {
        try {
            testStore.removeBucket(bucket);
        } catch (IOException e) {
            log.error("The test bucket {} could not be removed", bucket, e);
            repository.insertAlert("HIGH", "REHEARSAL_TEST_BUCKET_NOT_REMOVED", "The test bucket " + bucket + " is still on the object store and must be removed", bucket);
        }
    }

    private void dropScratch(String name) {
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword()); Statement st = c.createStatement()) {
            st.execute("drop database if exists \"" + name + "\" with (force)");
        } catch (SQLException e) {
            log.error("The scratch database {} could not be dropped", name, e);
            repository.insertAlert("HIGH", "REHEARSAL_SCRATCH_NOT_DROPPED", "The scratch database " + name + " is still on the server and must be dropped", name);
        }
    }

    private RestoreKeyring.Session openRing() throws Failure {
        try {
            return keyring.open();
        } catch (IOException e) {
            throw new Failure("RESTORE_KEY_UNAVAILABLE", e.getMessage());
        }
    }

    private static final class Failure extends IOException {
        final String code;

        Failure(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
