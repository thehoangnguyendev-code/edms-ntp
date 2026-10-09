package com.eqms.backup.agent.backup;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.policy.ActivePolicyProvider;
import com.eqms.backup.agent.policy.PolicyView;
import com.eqms.backup.agent.target.ReplicationService;
import com.eqms.backup.agent.verify.VerificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Backs up the eQMS database (SDS sections 5 and 20). One consistent snapshot is exported, the row counts are read from the
 * same snapshot, and {@code pg_dump} is run against that snapshot so the counts in the manifest describe exactly what was
 * dumped. The dump is encrypted on the way to disk; a plain copy is never written.
 */
@Service
public class DatabaseBackupService {

    private static final Logger log = LoggerFactory.getLogger(DatabaseBackupService.class);
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter YEAR = DateTimeFormatter.ofPattern("yyyy").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MM").withZone(ZoneOffset.UTC);

    public record Request(String type, String trigger, String requestedBy, String reason, String changeControlRef) {
    }

    public record Outcome(String backupId, boolean ok, String errorCode, String errorDetail, VerificationService.Outcome verification) {
    }

    /** A failure with a stable code; the code, not the message, is what screens and alerts key on. */
    static final class BackupException extends Exception {
        final String code;

        BackupException(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    private final AgentProperties properties;
    private final BackupRepository repository;
    private final LedgerService ledger;
    private final ManifestService manifests;
    private final CommandRunner runner;
    private final GpgKeyring keyring;
    private final VerificationService verification;
    private final ReplicationService replication;
    private final ObjectBackupService objects;
    private final ActivePolicyProvider policies;

    public DatabaseBackupService(AgentProperties properties, BackupRepository repository, LedgerService ledger, ManifestService manifests,
                                 CommandRunner runner, GpgKeyring keyring, VerificationService verification, ReplicationService replication, ObjectBackupService objects, ActivePolicyProvider policies) {
        this.properties = properties;
        this.repository = repository;
        this.ledger = ledger;
        this.manifests = manifests;
        this.runner = runner;
        this.keyring = keyring;
        this.verification = verification;
        this.replication = replication;
        this.objects = objects;
        this.policies = policies;
    }

    public Outcome run(Request request) {
        Instant started = Instant.now();
        String backupId = repository.nextBackupId(started);
        UUID runId;
        try {
            runId = repository.insertRun(backupId, properties.getEnvironment().toUpperCase(), request.type(), request.trigger(),
                    repository.activePolicyVersion().orElse(null), started, request.requestedBy(), request.reason(), request.changeControlRef());
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // the unique index allows one RUNNING backup per environment
            return new Outcome(backupId, false, "BACKUP_ALREADY_RUNNING", "Another backup is still running", null);
        }
        Map<String, Object> startedData = new LinkedHashMap<>();
        startedData.put("type", request.type());
        startedData.put("trigger", request.trigger());
        startedData.put("environment", properties.getEnvironment().toUpperCase());
        startedData.put("reason", request.reason() == null ? "" : request.reason());
        ledger.append(request.requestedBy(), "BACKUP_STARTED", backupId, startedData);

        // The active policy decides what is backed up and where it is copied. With no policy only the database is written, to T1.
        PolicyView policy = policies.active().orElse(null);
        boolean withObjects = objects.enabled() && policy != null && policy.includes("OBJECT_STORE");
        java.util.Set<String> copyTo = policy == null ? java.util.Set.of("T1") : policy.targetCodes();
        Path partial = null;
        try {
            Path envRoot = properties.getTargets().getT1().resolve(properties.getEnvironment().toUpperCase());
            Path setRoot = envRoot.resolve(YEAR.format(started)).resolve(MONTH.format(started));
            partial = setRoot.resolve(backupId + ".partial");
            preChecks(setRoot);
            Files.createDirectories(partial.resolve("database"));

            Path dumpFile = partial.resolve("database").resolve("eqms.dump.gpg");
            Map<String, Object> dbInfo = new LinkedHashMap<>();
            CommandRunner.PipelineResult dump = dumpDatabase(dumpFile, dbInfo);
            Instant snapshotAt = (Instant) dbInfo.get("snapshotAt");

            Map<String, Object> component = new LinkedHashMap<>();
            component.put("key", "DATABASE");
            component.put("file", "database/eqms.dump.gpg");
            component.put("sizeBytes", dump.bytes());
            component.put("sha256", dump.sha256());
            component.put("rowCounts", dbInfo.get("rowCounts"));
            component.put("largeObjectCount", dbInfo.get("largeObjectCount"));

            // The document store is listed after the database snapshot, so the manifest can say exactly when each was read.
            ObjectBackupService.Result stored = null;
            if (withObjects) {
                try {
                    stored = objects.run(runId, envRoot, partial);
                } catch (ObjectBackupService.ObjectBackupException e) {
                    throw new BackupException(e.code, e.getMessage());
                }
            }
            List<Object> components = new ArrayList<>();
            components.add(component);
            StringBuilder sums = new StringBuilder(dump.sha256() + "  database/eqms.dump.gpg\n");
            long totalBytes = dump.bytes();
            if (stored != null) {
                Map<String, Object> objectComponent = new LinkedHashMap<>();
                objectComponent.put("key", "OBJECT_STORE");
                objectComponent.put("file", "objects/index.json.gpg");
                objectComponent.put("sizeBytes", stored.indexBytes());
                objectComponent.put("sha256", stored.indexSha256());
                objectComponent.put("buckets", stored.buckets());
                objectComponent.put("versionCount", stored.totalVersions());
                objectComponent.put("newVersionCount", stored.newVersions());
                objectComponent.put("newBytes", stored.newBytes());
                objectComponent.put("deleteMarkerCount", stored.deleteMarkers());
                components.add(objectComponent);
                sums.append(stored.indexSha256()).append("  objects/index.json.gpg\n");
                totalBytes += stored.indexBytes() + stored.newBytes();
            }

            Map<String, Object> manifest = new LinkedHashMap<>();
            manifest.put("schema", "eqms-backup-manifest/1");
            manifest.put("backupId", backupId);
            manifest.put("type", request.type());
            manifest.put("trigger", request.trigger());
            manifest.put("environment", properties.getEnvironment().toUpperCase());
            manifest.put("startedAt", ISO.format(started));
            manifest.put("dbSnapshotAt", ISO.format(snapshotAt));
            manifest.put("objectListedAt", stored == null ? null : ISO.format(stored.listedAt()));
            manifest.put("app", Map.of("postgres", String.valueOf(dbInfo.get("serverVersion")), "flywayLatest", String.valueOf(dbInfo.get("flywayLatest")), "agent", "0.0.1"));
            manifest.put("providers", stored == null ? List.of() : List.of(Map.of("type", "S3", "buckets", stored.buckets())));
            manifest.put("components", components);
            manifest.put("encryption", Map.of("scheme", "OpenPGP", "cipher", "AES256", "recipientKeyId", keyring.keyId(), "encryptionKeyIds", keyring.encryptionKeyIds()));
            String previous = repository.latestManifestSha256().orElse(null);
            manifest.put("previousManifestSha256", previous);
            manifest.put("policyVersion", policy == null ? null : policy.version());
            manifest.put("signing", Map.of("alg", "Ed25519", "keyId", manifests.keyId()));
            ManifestService.SignedManifest signed = manifests.sign(manifest);

            Files.writeString(partial.resolve("manifest.json"), signed.text(), StandardCharsets.UTF_8);
            Files.writeString(partial.resolve("manifest.sig"), signed.signatureBase64() + "\n", StandardCharsets.US_ASCII);
            Files.writeString(partial.resolve("SHA256SUMS"), sums + signed.sha256() + "  manifest.json\n", StandardCharsets.UTF_8);

            Path finalDir = setRoot.resolve(backupId);
            Files.move(partial, finalDir, StandardCopyOption.ATOMIC_MOVE);
            partial = null;

            Instant finished = Instant.now();
            repository.insertComponent(runId, "DATABASE", "COMPLETED", dump.bytes(), null, dump.sha256(), CanonicalJson.of(dbInfo.get("rowCounts")));
            if (stored != null) {
                repository.insertComponent(runId, "OBJECT_STORE", "COMPLETED", stored.indexBytes() + stored.newBytes(), stored.totalVersions(), stored.indexSha256(), null);
            }
            repository.insertLocation(runId, "T1", finalDir.toString(), finished, dump.sha256(), true);
            repository.insertManifest(runId, signed.text(), signed.sha256(), signed.signatureBase64(), signed.keyId(), previous);
            repository.markCompleted(runId, finished, snapshotAt, totalBytes);
            Map<String, Object> done = new LinkedHashMap<>();
            done.put("sizeBytes", dump.bytes());
            done.put("sha256", dump.sha256());
            done.put("manifestSha256", signed.sha256());
            done.put("dbSnapshotAt", ISO.format(snapshotAt));
            if (stored != null) {
                done.put("objectVersions", stored.totalVersions());
                done.put("newObjectVersions", stored.newVersions());
                done.put("objectListedAt", ISO.format(stored.listedAt()));
            }
            ledger.append("agent", "BACKUP_COMPLETED", backupId, done);
            if (stored != null) {
                for (String gone : stored.missingInSource()) {
                    repository.insertAlert("HIGH", "OBJECT_MISSING_IN_SOURCE", "Backup " + backupId + ": " + gone + " was stored earlier but is no longer in the document store", backupId);
                    ledger.append("agent", "OBJECT_MISSING_IN_SOURCE", backupId, Map.of("object", gone));
                }
            }

            VerificationService.Outcome v1 = verification.verifyV1(backupId, "agent");
            // Other targets get a copy only after T1 has proved sound; a failed copy is recorded and alerted, never silent.
            if (v1.verified()) replication.replicate(runId, backupId, finalDir, properties.getEnvironment().toUpperCase() + "/" + YEAR.format(started) + "/" + MONTH.format(started), envRoot, copyTo);
            return new Outcome(backupId, true, null, null, v1);
        } catch (BackupException e) {
            return fail(runId, backupId, partial, e.code, e.getMessage());
        } catch (Exception e) {
            log.error("Backup {} failed", backupId, e);
            return fail(runId, backupId, partial, "BACKUP_UNEXPECTED_ERROR", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    private Outcome fail(UUID runId, String backupId, Path partial, String code, String detail) {
        if (partial != null && Files.exists(partial)) {
            try {
                Files.move(partial, partial.resolveSibling(backupId + ".failed"), StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException ignored) {
                // the partial folder is kept as it is; it is never listed as a valid backup
            }
        }
        repository.markFailed(runId, Instant.now(), code, detail);
        ledger.append("agent", "BACKUP_FAILED", backupId, Map.of("code", code));
        repository.insertAlert("HIGH", code, "Backup " + backupId + " failed: " + detail, backupId);
        return new Outcome(backupId, false, code, detail, null);
    }

    /** Fails early and clearly, before any data is read (SDS section 10.1). */
    void preChecks(Path setRoot) throws BackupException {
        try {
            Files.createDirectories(setRoot);
            byte[] probe = new byte[4096];
            new SecureRandom().nextBytes(probe);
            Path probeFile = setRoot.resolve(".probe-" + UUID.randomUUID());
            Files.write(probeFile, probe);
            boolean same = java.util.Arrays.equals(probe, Files.readAllBytes(probeFile));
            Files.delete(probeFile);
            if (!same) throw new BackupException("BACKUP_TARGET_UNAVAILABLE", "The target returned different bytes than were written");
            long usable = Files.getFileStore(setRoot).getUsableSpace();
            long needed = Math.max(properties.getMinFreeBytes(), (long) (repository.lastCompletedSize().orElse(0L) * 1.5));
            if (usable < needed) {
                throw new BackupException("BACKUP_INSUFFICIENT_SPACE", "The target has " + usable + " bytes free; at least " + needed + " are needed");
            }
        } catch (IOException e) {
            throw new BackupException("BACKUP_TARGET_UNAVAILABLE", "The target cannot be written: " + e.getMessage());
        }
        try {
            keyring.fingerprint();
        } catch (IllegalStateException e) {
            throw new BackupException("BACKUP_ENCRYPTION_KEY_MISSING", e.getMessage());
        }
    }

    private String sourceUrl() {
        AgentProperties.Source s = properties.getSource();
        return "jdbc:postgresql://" + s.getHost() + ":" + s.getPort() + "/" + s.getDatabase();
    }

    private CommandRunner.PipelineResult dumpDatabase(Path out, Map<String, Object> info) throws Exception {
        AgentProperties.Source s = properties.getSource();
        try (Connection c = DriverManager.getConnection(sourceUrl(), s.getUser(), s.getPassword())) {
            c.setAutoCommit(false);
            c.setReadOnly(true);
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            String snapshotId;
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select pg_export_snapshot(), now(), current_setting('server_version')")) {
                rs.next();
                snapshotId = rs.getString(1);
                info.put("snapshotAt", rs.getTimestamp(2).toInstant());
                info.put("serverVersion", rs.getString(3));
            }
            info.put("rowCounts", rowCounts(c));
            // Large objects live outside the tables, so a table row count alone would not notice losing them.
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select count(*) from pg_largeobject_metadata")) {
                rs.next();
                info.put("largeObjectCount", rs.getLong(1));
            }
            info.put("flywayLatest", flywayLatest(c));

            List<CommandRunner.Command> pipeline = List.of(
                    new CommandRunner.Command(List.of(properties.getTools().getPgDump(), "-h", s.getHost(), "-p", String.valueOf(s.getPort()), "-U", s.getUser(),
                            "-d", s.getDatabase(), "-Fc", "--no-owner", "--no-privileges", "--snapshot=" + snapshotId), Map.of("PGPASSWORD", s.getPassword())),
                    keyring.encryptCommand());
            CommandRunner.PipelineResult result = runner.pipelineToFile(pipeline, out, 3600);
            c.rollback();
            if (!result.ok()) {
                Files.deleteIfExists(out);
                throw new BackupException("BACKUP_DUMP_FAILED", "pg_dump or gpg failed (exit codes " + result.exitCodes() + "): " + result.stderrTail());
            }
            if (result.bytes() == 0) {
                throw new BackupException("BACKUP_DUMP_FAILED", "The dump is empty");
            }
            return result;
        } catch (SQLException e) {
            throw new BackupException("BACKUP_SOURCE_UNAVAILABLE", "The database could not be read: " + e.getMessage());
        }
    }

    private Map<String, Object> rowCounts(Connection c) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select tablename from pg_tables where schemaname = 'public' order by tablename")) {
            while (rs.next()) tables.add(rs.getString(1));
        }
        Map<String, Object> counts = new LinkedHashMap<>();
        for (String table : tables) {
            try (PreparedStatement ps = c.prepareStatement("select count(*) from public.\"" + table.replace("\"", "\"\"") + "\""); ResultSet rs = ps.executeQuery()) {
                rs.next();
                counts.put(table, rs.getLong(1));
            }
        }
        return counts;
    }

    /** One statement that cannot fail: an error here would abort the transaction that holds the exported snapshot. */
    private String flywayLatest(Connection c) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "select case when to_regclass('public.flyway_schema_history') is null then null "
                        + "else (select max(version::int)::text from flyway_schema_history where version ~ '^[0-9]+$') end")) {
            return rs.next() ? rs.getString(1) : null;
        } catch (SQLException e) {
            return null;
        }
    }
}
