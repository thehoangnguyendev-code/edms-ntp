package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import com.eqms.backup.agent.objects.MinioLiveStore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Runs a production restore with the real parts (SDS-BR-003): the maintenance lock, the kept restore of the database, the add-only
 * file restore, the swap, the check of the live database and the wait for finalization. It is run by the restore worker, the only
 * process that holds the private key. Nothing happens unless the swap role and the live-file account are configured.
 */
@Service
public class ProductionRestoreService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final RestoreKeepService keeps;
    private final MaintenanceService maintenance;
    private final BackupRepository repository;
    private final RestoreKeyring keyring;
    private final CommandRunner runner;
    private final AgentProperties properties;

    public ProductionRestoreService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, RestoreKeepService keeps, MaintenanceService maintenance,
                                    BackupRepository repository, RestoreKeyring keyring, CommandRunner runner, AgentProperties properties) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.keeps = keeps;
        this.maintenance = maintenance;
        this.repository = repository;
        this.keyring = keyring;
        this.runner = runner;
        this.properties = properties;
    }

    public RestoreLifecycleService lifecycle() {
        return new RestoreLifecycleService(jdbc, tx, ledger, swap());
    }

    /** Restores the backup into production. The signature reference has been verified by the caller. */
    public RestoreRunEngine.Outcome run(String backupNumber, String by, String signatureRef) {
        return run(backupNumber, by, signatureRef, null);
    }

    /** {@code parts} are the parts to restore; null means what the backup holds of the database and the files. */
    public RestoreRunEngine.Outcome run(String backupNumber, String by, String signatureRef, java.util.Set<String> parts) {
        requireConfigured();
        java.util.Set<String> held = partsOf(backupNumber);
        java.util.Set<String> chosen = parts == null || parts.isEmpty() ? defaultParts(held) : parts;
        if (!held.containsAll(chosen)) {
            throw ExportException.conflict("RESTORE_PART_NOT_IN_BACKUP", "This backup does not hold: " + String.join(", ", chosen.stream().filter(p -> !held.contains(p)).sorted().toList()));
        }
        DatabaseSwap swap = swap();
        RestoreRunEngine.Alerter alerter = (code, detail, ref) -> repository.insertAlert("HIGH", code, detail, ref);
        RestoreRunEngine engine = new RestoreRunEngine(jdbc, ledger, alerter);
        RestoreLifecycleService lifecycle = new RestoreLifecycleService(jdbc, tx, ledger, swap);
        String live = properties.getRestore().getSwap().getLiveDatabase();
        return new ProductionRestore(engine, swap, lifecycle, new RealStages(), live, alerter).run(backupNumber, by, signatureRef, chosen);
    }

    /** The parts the backup holds, read from its signed manifest. */
    private java.util.Set<String> partsOf(String backupNumber) {
        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
        List<String> text = jdbc.queryForList("select manifest_text from backup_manifest where run_id = ?", String.class, run.get("id"));
        if (text.isEmpty()) throw ExportException.conflict("RESTORE_MANIFEST_MISSING", "The manifest of this backup is not recorded");
        try {
            java.util.Set<String> out = new java.util.LinkedHashSet<>();
            JSON.readTree(text.get(0)).path("components").forEach(c -> out.add(c.path("key").asText()));
            return out;
        } catch (IOException e) {
            throw ExportException.conflict("RESTORE_MANIFEST_UNREADABLE", "The manifest of this backup cannot be read");
        }
    }

    /** With no choice: the database and the files, when the backup holds them. A settings part held by an older backup is not restorable on its own. */
    private static java.util.Set<String> defaultParts(java.util.Set<String> held) {
        java.util.Set<String> out = new java.util.LinkedHashSet<>();
        if (held.contains("DATABASE")) out.add("DATABASE");
        if (held.contains("OBJECT_STORE")) out.add("OBJECT_STORE");
        return out;
    }

    private void requireConfigured() {
        if (!properties.getRestore().isEnabled()) throw ExportException.conflict("RESTORE_DISABLED", "This process is not the restore worker");
        if (!properties.getRestore().getSwap().configured()) {
            throw ExportException.conflict("RESTORE_SWAP_NOT_CONFIGURED", "The role that swaps the database is not configured");
        }
        if (!properties.getRestore().getLiveObjects().configured()) {
            throw ExportException.conflict("RESTORE_FILES_NOT_CONFIGURED", "The account that adds files to the live store is not configured");
        }
    }

    private DatabaseSwap swap() {
        AgentProperties.Restore r = properties.getRestore();
        AgentProperties.Swap s = r.getSwap();
        return new DatabaseSwap(new DriverManagerDataSource(adminUrl(), s.getUser(), s.getPassword()),
                s.getEndSessionsFunction().isBlank() ? null : s.getEndSessionsFunction(), s.getOwnerRole().isBlank() ? null : s.getOwnerRole());
    }

    private String adminUrl() {
        return url("postgres");
    }

    private String url(String db) {
        return "jdbc:postgresql://" + properties.getRestore().getHost() + ":" + properties.getRestore().getPort() + "/" + db;
    }

    private Connection restoreConnection(String db) throws SQLException {
        return DriverManager.getConnection(url(db), properties.getRestore().getUser(), properties.getRestore().getPassword());
    }

    /** The stages that need the keys, the maintenance lock and the stores. One instance serves one run. */
    private final class RealStages implements ProductionRestore.Stages {

        private String kept;

        @Override
        public void assertGate(String restoreNumber) throws Exception {
            MaintenanceService.Status status = maintenance.status();
            if (status.state() != MaintenanceService.State.LOCKED_RESTORING) {
                throw new RestoreRunEngine.StepFailure("RESTORE_NOT_LOCKED", "The system must be locked for restore before it runs; it is " + status.state());
            }
        }

        @Override
        public String restoreToKeptDatabase(String backupNumber, String by) {
            kept = String.valueOf(keeps.keep(backupNumber, by).get("database"));
            return kept;
        }

        @Override
        public Map<String, Object> addMissingFiles(String backupNumber, String restoredDatabase) throws Exception {
            Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
            UUID runId = (UUID) run.get("id");
            Path setDir = Path.of(jdbc.queryForObject("select path from backup_set_location where run_id = ? and target_code = 'T1'", String.class, runId));
            Path envRoot = setDir.getParent().getParent().getParent();
            AgentProperties.LiveObjects live = properties.getRestore().getLiveObjects();
            MinioLiveStore store = new MinioLiveStore(live.getEndpoint(), live.getAccessKey(), live.getSecretKey(), new HashSet<>(live.getBuckets()));
            String target = restoredDatabase != null ? restoredDatabase : properties.getRestore().getSwap().getLiveDatabase();
            try (RestoreKeyring.Session ring = keyring.open(); Connection restored = restoreConnection(target)) {
                MissingFileRestorer restorer = new MissingFileRestorer(store, (blob, dest) -> {
                    Files.deleteIfExists(dest);
                    CommandRunner.PipelineResult result = runner.pipelineToFile(List.of(ring.decrypt(envRoot.resolve(blob.path()))), dest, 3600);
                    if (!result.ok()) throw new IOException("Object " + blob.bucket() + "/" + blob.key() + " did not decrypt: " + result.stderrTail());
                    return result.sha256();
                });
                return restorer.toDetail(restorer.run(() -> repository.blobsUpTo(runId), restored));
            }
        }

        @Override
        public Map<String, Object> checkLive(String backupNumber) throws Exception {
            Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> ExportException.notFound("BACKUP_NOT_FOUND", "There is no backup " + backupNumber));
            String manifestText = jdbc.queryForObject("select manifest_text from backup_manifest where run_id = ?", String.class, run.get("id"));
            JsonNode manifest = JSON.readTree(manifestText);
            Instant snapshotAt = Instant.parse(manifest.path("dbSnapshotAt").asText());
            List<PostRestoreChecks.Result> checks;
            try (Connection c = restoreConnection(properties.getRestore().getSwap().getLiveDatabase())) {
                checks = PostRestoreChecks.run(c, manifest, snapshotAt);
            }
            List<String> failed = new ArrayList<>();
            Map<String, Object> out = new LinkedHashMap<>();
            for (PostRestoreChecks.Result r : checks) {
                out.put(r.code(), r.ok());
                if (r.required() && !r.ok()) failed.add(r.code() + ": " + r.detail());
            }
            if (!failed.isEmpty()) throw new RestoreRunEngine.StepFailure("RESTORE_LIVE_CHECK_FAILED", String.join(" | ", failed));
            return out;
        }

        @Override
        public void discardKept(String database) throws Exception {
            if (!database.matches("eqms_keep_[a-z0-9_]{1,40}")) throw new IllegalStateException("Refusing to drop " + database);
            try (Connection c = DriverManager.getConnection(adminUrl(), properties.getRestore().getUser(), properties.getRestore().getPassword());
                 Statement st = c.createStatement()) {
                st.execute("drop database if exists \"" + database + "\" with (force)");
            }
        }
    }
}
