package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
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
 * A restore that keeps its database (SDS 11.3, R6-R7). The backup's database dump is decrypted and restored into a new database, its
 * checks are run, and the database is KEPT, so that a maintenance window can swap it in. It is run by the restore worker, the only
 * process that holds the private key. A failed restore drops its database. The record is kept in restore_keep.
 */
@Service
public class RestoreKeepService {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.UTC);

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;
    private final BackupRepository repository;
    private final ManifestService manifests;
    private final CommandRunner runner;
    private final RestoreKeyring keyring;
    private final AgentProperties properties;

    public RestoreKeepService(JdbcTemplate jdbc, LedgerService ledger, BackupRepository repository, ManifestService manifests,
                              CommandRunner runner, RestoreKeyring keyring, AgentProperties properties) {
        this.jdbc = jdbc;
        this.ledger = ledger;
        this.repository = repository;
        this.manifests = manifests;
        this.runner = runner;
        this.keyring = keyring;
        this.properties = properties;
    }

    /** Restores the backup into a kept database and returns its name and checks. Throws ExportException when the backup cannot be used. */
    public Map<String, Object> keep(String backupNumber, String by) {
        String who = by == null || by.isBlank() ? null : by.trim();
        if (who == null) throw ExportException.invalid("PERSON_REQUIRED", "Who is asking must be known");
        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
        if (!"COMPLETED".equals(run.get("status"))) throw ExportException.conflict("RESTORE_KEEP_BACKUP_NOT_COMPLETED", "Only a completed backup can be restored");
        String latest = jdbc.queryForList("select result from backup_verification where run_id = ? order by verified_at desc limit 1", String.class, run.get("id"))
                .stream().findFirst().orElse("NOT_VERIFIED");
        if (!"VERIFIED".equals(latest)) throw ExportException.conflict("RESTORE_KEEP_BACKUP_NOT_VERIFIED", "Only a backup whose latest check passed can be restored");

        String keepCode = "KP-" + STAMP.format(Instant.now());
        String db = "eqms_keep_" + keepCode.substring(3).toLowerCase(Locale.ROOT);
        if (!db.matches("eqms_keep_[a-z0-9_]{1,40}") || db.equalsIgnoreCase(properties.getSource().getDatabase())) {
            throw new IllegalStateException("Refusing keep database name " + db);
        }
        List<PostRestoreChecks.Result> checks = new ArrayList<>();
        boolean created = false;
        try (RestoreKeyring.Session ring = keyring.open()) {
            UUID runId = (UUID) run.get("id");
            Map<String, Object> manifestRow = jdbc.queryForList("select manifest_text, signature_base64 from backup_manifest where run_id = ?", runId).stream().findFirst()
                    .orElseThrow(() -> ExportException.conflict("RESTORE_KEEP_MANIFEST_MISSING", "The manifest of this backup is not recorded"));
            String manifestText = (String) manifestRow.get("manifest_text");
            if (!manifests.signatureValid(manifestText, (String) manifestRow.get("signature_base64"))) {
                throw ExportException.conflict("RESTORE_KEEP_SIGNATURE", "The manifest signature does not verify");
            }
            JsonNode manifest = JSON.readTree(manifestText);
            Path setDir = Path.of(jdbc.queryForObject("select path from backup_set_location where run_id = ? and target_code = 'T1'", String.class, runId));
            List<String> wanted = new ArrayList<>();
            manifest.path("encryption").path("encryptionKeyIds").forEach(n -> wanted.add(n.asText().toUpperCase(Locale.ROOT)));
            List<String> held = ring.secretKeyIds();
            if (wanted.stream().noneMatch(held::contains)) throw ExportException.conflict("RESTORE_KEEP_KEY", "The restore key ring does not hold a key this backup was encrypted to");

            createDatabase(db);
            created = true;
            restoreDump(ring, setDir, db);
            checks.add(new PostRestoreChecks.Result("RESTORE_DATABASE", "The database dump decrypts and restores", true, true, "Restored into " + db));
            Instant snapshotAt = Instant.parse(manifest.path("dbSnapshotAt").asText());
            try (Connection c = DriverManager.getConnection(url(db), properties.getRestore().getUser(), properties.getRestore().getPassword())) {
                checks.addAll(PostRestoreChecks.run(c, manifest, snapshotAt));
            }
            boolean ok = checks.stream().filter(PostRestoreChecks.Result::required).allMatch(PostRestoreChecks.Result::ok);
            if (!ok) {
                throw ExportException.conflict("RESTORE_KEEP_CHECK_FAILED", checks.stream().filter(c -> c.required() && !c.ok())
                        .map(c -> c.code() + ": " + c.detail()).reduce((a, b) -> a + " | " + b).orElse(""));
            }
            Map<String, Object> checkMap = new LinkedHashMap<>();
            for (PostRestoreChecks.Result c : checks) checkMap.put(c.code(), c.ok());
            jdbc.update("insert into restore_keep(keep_code, backup_number, db_name, status, requested_by, checks_json) values (?,?,?,'READY',?,?::jsonb)",
                    keepCode, backupNumber, db, who, CanonicalJson.of(checkMap));
            ledger.append(who, "RESTORE_KEEP_READY", backupNumber, Map.of("keepCode", keepCode, "database", db));
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("keepCode", keepCode);
            out.put("database", db);
            out.put("backupNumber", backupNumber);
            out.put("checks", checkMap);
            return out;
        } catch (ExportException e) {
            dropQuietly(db, created);
            recordFailure(keepCode, backupNumber, db, who, e.code, e.getMessage());
            throw e;
        } catch (IOException | SQLException | RuntimeException e) {
            dropQuietly(db, created);
            recordFailure(keepCode, backupNumber, db, who, "RESTORE_KEEP_ERROR", e.getMessage());
            throw new IllegalStateException("The kept restore failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            dropQuietly(db, created);
            throw new IllegalStateException("The kept restore was interrupted", e);
        }
    }

    private void recordFailure(String keepCode, String backupNumber, String db, String who, String code, String detail) {
        String text = detail == null ? null : (detail.length() > 4000 ? detail.substring(0, 4000) : detail);
        jdbc.update("insert into restore_keep(keep_code, backup_number, db_name, status, requested_by, error_code, error_detail) values (?,?,?,'FAILED',?,?,?)",
                keepCode, backupNumber, db + "_failed_" + keepCode.substring(3), who, code, text);
        ledger.append(who, "RESTORE_KEEP_FAILED", backupNumber, Map.of("keepCode", keepCode, "code", code));
    }

    private void dropQuietly(String db, boolean created) {
        if (!created) return;
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword());
             Statement st = c.createStatement()) {
            st.execute("drop database if exists \"" + db + "\" with (force)");
        } catch (SQLException e) {
            repository.insertAlert("HIGH", "RESTORE_KEEP_NOT_DROPPED", "The failed restore database " + db + " is still on the server and must be dropped", db);
        }
    }

    private void restoreDump(RestoreKeyring.Session ring, Path setDir, String db) throws IOException, InterruptedException, ExportException {
        Path sink = Files.createTempFile("keep-", ".out");
        Files.delete(sink);
        CommandRunner.PipelineResult restored = runner.pipelineToFile(List.of(
                ring.decrypt(setDir.resolve("database/eqms.dump.gpg")),
                new CommandRunner.Command(List.of(properties.getTools().getPgRestore(), "-h", properties.getRestore().getHost(), "-p", String.valueOf(properties.getRestore().getPort()),
                        "-U", properties.getRestore().getUser(), "-d", db, "--no-owner", "--exit-on-error"), Map.of("PGPASSWORD", properties.getRestore().getPassword()))),
                sink, 3 * 3600);
        Files.deleteIfExists(sink);
        if (!restored.ok()) throw ExportException.conflict("RESTORE_KEEP_RESTORE_FAILED", "The database could not be restored (exit codes " + restored.exitCodes() + "): " + restored.stderrTail());
    }

    private void createDatabase(String name) throws SQLException {
        try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword());
             Statement st = c.createStatement()) {
            st.execute("create database \"" + name + "\"");
        }
    }

    private String adminUrl() {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/postgres";
    }

    private String url(String name) {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/" + name;
    }
}
