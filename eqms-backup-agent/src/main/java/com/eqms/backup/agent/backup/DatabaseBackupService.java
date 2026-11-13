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

    /**
     * What a backup may contain: the whole database (the system settings are part of it) and the stored files. The separate settings part
     * was removed on 2026-11-11; backups made with it stay valid and are not changed.
     */
    public static final java.util.Set<String> ALL_COMPONENTS = java.util.Set.of("DATABASE", "OBJECT_STORE");

    /**
     * {@code components} are the parts the person chose (one or more of {@link #ALL_COMPONENTS}); null or empty means what the active policy
     * covers, which is how scheduled backups run.
     */
    public record Request(String type, String trigger, String requestedBy, String reason, String changeControlRef, java.util.Set<String> components) {
        public Request(String type, String trigger, String requestedBy, String reason, String changeControlRef) {
            this(type, trigger, requestedBy, reason, changeControlRef, null);
        }
    }

    public record Outcome(String backupNumber, boolean ok, String errorCode, String errorDetail, VerificationService.Outcome verification) {
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
        String backupNumber = repository.nextBackupId(started);
        UUID runId;
        try {
            runId = repository.insertRun(backupNumber, properties.getEnvironment().toUpperCase(), request.type(), request.trigger(),
                    repository.activePolicyVersion().orElse(null), started, request.requestedBy(), request.reason(), request.changeControlRef());
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // the unique index allows one RUNNING backup per environment
            return new Outcome(backupNumber, false, "BACKUP_ALREADY_RUNNING", "Another backup is still running", null);
        }
        Map<String, Object> startedData = new LinkedHashMap<>();
        startedData.put("type", request.type());
        startedData.put("trigger", request.trigger());
        startedData.put("environment", properties.getEnvironment().toUpperCase());
        startedData.put("reason", request.reason() == null ? "" : request.reason());
        ledger.append(request.requestedBy(), "BACKUP_STARTED", backupNumber, startedData);

        // The active policy decides what is backed up and where it is copied. With no policy only the database is written, to T1.
        PolicyView policy = policies.active().orElse(null);
        java.util.Set<String> wanted;
        try {
            wanted = resolveComponents(request, policy);
        } catch (BackupException e) {
            return fail(runId, backupNumber, null, e.code, e.getMessage());
        }
        boolean withDatabase = wanted.contains("DATABASE");
        boolean withObjects = wanted.contains("OBJECT_STORE");
        java.util.Set<String> copyTo = policy == null ? java.util.Set.of("T1") : policy.targetCodes();
        Path partial = null;
        try {
            Path envRoot = properties.getTargets().getT1().resolve(properties.getEnvironment().toUpperCase());
            Path setRoot = envRoot.resolve(YEAR.format(started)).resolve(MONTH.format(started));
            partial = setRoot.resolve(backupNumber + ".partial");
            preChecks(setRoot);
            Files.createDirectories(partial);

            List<Object> components = new ArrayList<>();
            StringBuilder sums = new StringBuilder();
            long totalBytes = 0;
            Instant snapshotAt = null;
            String firstSha = null;
            Map<String, Object> dbInfo = new LinkedHashMap<>();
            CommandRunner.PipelineResult dump = null;

            if (withDatabase) {
                Files.createDirectories(partial.resolve("database"));
                dump = dumpDatabase(partial.resolve("database").resolve("eqms.dump.gpg"), dbInfo);
                snapshotAt = (Instant) dbInfo.get("snapshotAt");
                Map<String, Object> component = new LinkedHashMap<>();
                component.put("key", "DATABASE");
                component.put("file", "database/eqms.dump.gpg");
                component.put("sizeBytes", dump.bytes());
                component.put("sha256", dump.sha256());
                component.put("rowCounts", dbInfo.get("rowCounts"));
                component.put("largeObjectCount", dbInfo.get("largeObjectCount"));
                components.add(component);
                sums.append(dump.sha256()).append("  database/eqms.dump.gpg\n");
                totalBytes += dump.bytes();
                firstSha = dump.sha256();
            }

            // The document store is listed after the database snapshot, so the manifest can say exactly when each was read.
            ObjectBackupService.Result stored = null;
            if (withObjects) {
                try {
                    stored = objects.run(runId, envRoot, partial);
                } catch (ObjectBackupService.ObjectBackupException e) {
                    throw new BackupException(e.code, e.getMessage());
                }
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
                if (firstSha == null) firstSha = stored.indexSha256();
                if (snapshotAt == null) snapshotAt = stored.listedAt();
            }

            Map<String, Object> manifest = new LinkedHashMap<>();
            manifest.put("schema", "eqms-backup-manifest/1");
            manifest.put("backupNumber", backupNumber);
            manifest.put("type", request.type());
            manifest.put("trigger", request.trigger());
            manifest.put("environment", properties.getEnvironment().toUpperCase());
            manifest.put("startedAt", ISO.format(started));
            manifest.put("dbSnapshotAt", withDatabase ? ISO.format((Instant) dbInfo.get("snapshotAt")) : null);
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

            Path finalDir = setRoot.resolve(backupNumber);
            Files.move(partial, finalDir, StandardCopyOption.ATOMIC_MOVE);
            partial = null;

            Instant finished = Instant.now();
            if (dump != null) repository.insertComponent(runId, "DATABASE", "COMPLETED", dump.bytes(), null, dump.sha256(), CanonicalJson.of(dbInfo.get("rowCounts")));
            if (stored != null) {
                repository.insertComponent(runId, "OBJECT_STORE", "COMPLETED", stored.indexBytes() + stored.newBytes(), stored.totalVersions(), stored.indexSha256(), null);
            }
            repository.insertLocation(runId, "T1", finalDir.toString(), finished, firstSha, true);
            repository.insertManifest(runId, signed.text(), signed.sha256(), signed.signatureBase64(), signed.keyId(), previous);
            repository.markCompleted(runId, finished, snapshotAt, totalBytes);
            Map<String, Object> done = new LinkedHashMap<>();
            done.put("components", wanted.stream().sorted().toList());
            done.put("sizeBytes", totalBytes);
            done.put("sha256", firstSha);
            done.put("manifestSha256", signed.sha256());
            done.put("snapshotAt", ISO.format(snapshotAt));
            if (stored != null) {
                done.put("objectVersions", stored.totalVersions());
                done.put("newObjectVersions", stored.newVersions());
                done.put("objectListedAt", ISO.format(stored.listedAt()));
            }
            ledger.append("agent", "BACKUP_COMPLETED", backupNumber, done);
            if (stored != null) {
                for (String gone : stored.missingInSource()) {
                    repository.insertAlert("HIGH", "OBJECT_MISSING_IN_SOURCE", "Backup " + backupNumber + ": " + gone + " was stored earlier but is no longer in the document store", backupNumber);
                    ledger.append("agent", "OBJECT_MISSING_IN_SOURCE", backupNumber, Map.of("object", gone));
                }
            }

            if (withDatabase && stored != null) checkReferences(backupNumber);
            VerificationService.Outcome v1 = verification.verifyV1(backupNumber, "agent");
            // Other targets get a copy only after T1 has proved sound; a failed copy is recorded and alerted, never silent.
            if (v1.verified()) replication.replicate(runId, backupNumber, finalDir, properties.getEnvironment().toUpperCase() + "/" + YEAR.format(started) + "/" + MONTH.format(started), envRoot, copyTo);
            return new Outcome(backupNumber, true, null, null, v1);
        } catch (BackupException e) {
            return fail(runId, backupNumber, partial, e.code, e.getMessage());
        } catch (Exception e) {
            log.error("Backup {} failed", backupNumber, e);
            return fail(runId, backupNumber, partial, "BACKUP_UNEXPECTED_ERROR", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    private Outcome fail(UUID runId, String backupNumber, Path partial, String code, String detail) {
        if (partial != null && Files.exists(partial)) {
            try {
                Files.move(partial, partial.resolveSibling(backupNumber + ".failed"), StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException ignored) {
                // the partial folder is kept as it is; it is never listed as a valid backup
            }
        }
        repository.markFailed(runId, Instant.now(), code, detail);
        ledger.append("agent", "BACKUP_FAILED", backupNumber, Map.of("code", code));
        repository.insertAlert("HIGH", code, "Backup " + backupNumber + " failed: " + detail, backupNumber);
        return new Outcome(backupNumber, false, code, detail, null);
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

    /**
     * When a backup holds both the database and the files: every file the database refers to (the registered columns) must be in the file
     * index. One that is not is reported, never silently left out; the backup is still valid (decision of 2026-11-09).
     */
    private void checkReferences(String backupNumber) {
        AgentProperties.Source s = properties.getSource();
        try (Connection c = DriverManager.getConnection(sourceUrl(), s.getUser(), s.getPassword())) {
            c.setReadOnly(true);
            java.util.Set<String> indexed = new java.util.HashSet<>();
            java.util.Set<String> indexedKeys = new java.util.HashSet<>();
            for (BackupRepository.Blob b : repository.allBlobs()) {
                indexed.add(b.bucket() + "\0" + b.key() + "\0" + b.versionId());
                indexedKeys.add(b.bucket() + "\0" + b.key());
            }
            java.util.Set<String> aliased = new java.util.HashSet<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select bucket, object_key, original_version_id from object_version_alias")) {
                while (rs.next()) aliased.add(rs.getString(1) + "\0" + rs.getString(2) + "\0" + rs.getString(3));
            } catch (SQLException e) {
                // no alias table in this database: nothing was ever restored into it
            }
            List<String> missing = new ArrayList<>();
            int checked = 0;
            for (var col : com.eqms.backup.agent.restore.MissingFileRestorer.REGISTRY) {
                String versionExpr = col.version() == null ? "null" : "\"" + col.version() + "\"";
                String sql = "select distinct \"" + col.bucket() + "\", \"" + col.key() + "\", " + versionExpr + " from \"" + col.table() + "\" where \"" + col.key() + "\" is not null";
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                    while (rs.next()) {
                        String bucket = rs.getString(1);
                        String key = rs.getString(2);
                        String version = rs.getString(3);
                        if (bucket == null || !properties.getObjects().getBuckets().contains(bucket)) continue;
                        checked++;
                        boolean found = version == null ? indexedKeys.contains(bucket + "\0" + key)
                                : indexed.contains(bucket + "\0" + key + "\0" + version) || aliased.contains(bucket + "\0" + key + "\0" + version);
                        if (!found) missing.add(col.table() + " -> " + bucket + "/" + key + (version == null ? "" : "@" + version));
                    }
                } catch (SQLException e) {
                    // a table or column that does not exist in this database holds no reference
                }
            }
            if (!missing.isEmpty()) {
                repository.insertAlert("WARNING", "BACKUP_REFERENCE_MISSING", "Backup " + backupNumber + ": " + missing.size() + " of " + checked
                        + " file reference(s) in the database are not in the file index, for example " + String.join("; ", missing.subList(0, Math.min(5, missing.size()))), backupNumber);
                ledger.append("agent", "BACKUP_REFERENCES_MISSING", backupNumber, Map.of("missing", missing.size(), "checked", checked));
            }
        } catch (SQLException e) {
            log.warn("The file references of backup {} could not be checked: {}", backupNumber, e.getMessage());
        }
    }

    private String sourceUrl() {
        AgentProperties.Source s = properties.getSource();
        return "jdbc:postgresql://" + s.getHost() + ":" + s.getPort() + "/" + s.getDatabase();
    }

    /** The parts to back up: what the person chose, or what the active policy covers. */
    private java.util.Set<String> resolveComponents(Request request, PolicyView policy) throws BackupException {
        java.util.Set<String> wanted = new java.util.LinkedHashSet<>();
        if (request.components() == null || request.components().isEmpty()) {
            wanted.add("DATABASE");
            if (objects.enabled() && policy != null && policy.includes("OBJECT_STORE")) wanted.add("OBJECT_STORE");
            return wanted;
        }
        for (String c : request.components()) {
            if ("CONFIGURATION".equals(c)) throw new BackupException("BACKUP_COMPONENT_REMOVED", "The system settings are part of the database backup; they are no longer backed up as a separate part");
            if (!ALL_COMPONENTS.contains(c)) throw new BackupException("BACKUP_COMPONENT_UNKNOWN", "Unknown backup component " + c);
            wanted.add(c);
        }
        if (wanted.contains("OBJECT_STORE") && !objects.enabled()) {
            throw new BackupException("BACKUP_OBJECTS_NOT_CONFIGURED", "The document store is not configured on this agent, so the files cannot be backed up");
        }
        return wanted;
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
            List<String> allTables = tableNames(c);
            info.put("allTables", allTables);
            info.put("rowCounts", rowCounts(c, allTables));
            // Large objects live outside the tables, so a table row count alone would not notice losing them.
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select count(*) from pg_largeobject_metadata")) {
                rs.next();
                info.put("largeObjectCount", rs.getLong(1));
            }
            info.put("flywayLatest", flywayLatest(c));

            List<String> dumpArgs = new ArrayList<>(List.of(properties.getTools().getPgDump(), "-h", s.getHost(), "-p", String.valueOf(s.getPort()), "-U", s.getUser(),
                    "-d", s.getDatabase(), "-Fc", "--no-owner", "--no-privileges", "--snapshot=" + snapshotId));
            List<CommandRunner.Command> pipeline = List.of(
                    new CommandRunner.Command(dumpArgs, Map.of("PGPASSWORD", s.getPassword())),
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

    private List<String> tableNames(Connection c) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select tablename from pg_tables where schemaname = 'public' order by tablename")) {
            while (rs.next()) tables.add(rs.getString(1));
        }
        return tables;
    }

    private Map<String, Object> rowCounts(Connection c, List<String> wanted) throws SQLException {
        List<String> tables = tableNames(c).stream().filter(wanted::contains).toList();
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
