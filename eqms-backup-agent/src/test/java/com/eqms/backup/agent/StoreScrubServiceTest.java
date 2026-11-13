package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.objects.StoreScrubService;
import com.eqms.backup.agent.verify.VerificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The periodic check of the live file store and the check of file references at backup time. The store is in memory; the document
 * database is a throw-away one. Every difference kind has its own case: size, same-size content, missing, and a checksum recorded at signing.
 */
class StoreScrubServiceTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeObjectSource docs;
    BackupRepository repository;
    DatabaseBackupService backups;
    StoreScrubService scrub;
    String source;
    String sha;

    private Connection sourceConnection() throws Exception {
        return DriverManager.getConnection("jdbc:postgresql://" + db.host() + ":" + db.port() + "/" + source, db.user(), db.password());
    }

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        source = db.createSourceDb();
        properties = new AgentProperties();
        properties.setEnvironment("DEV");
        properties.setLedgerDir(tmp.resolve("ledger"));
        properties.getTargets().setT1(tmp.resolve("t1"));
        properties.getCrypto().setSigningKeyFile(tmp.resolve("agent").resolve("signing.key"));
        properties.getCrypto().setPublicKeyFile(tmp.resolve("public.asc"));
        Files.writeString(tmp.resolve("public.asc"), "fake public key");
        properties.getCrypto().setGpgHome(tmp.resolve("gnupg").toString());
        properties.setMinFreeBytes(1024);
        properties.getSource().setHost(db.host());
        properties.getSource().setPort(db.port());
        properties.getSource().setDatabase(source);
        properties.getSource().setUser(db.user());
        properties.getSource().setPassword(db.password());
        properties.getObjects().setEnabled(true);
        properties.getObjects().setBuckets(List.of("docs"));
        FakeCommandRunner runner = new FakeCommandRunner();
        docs = new FakeObjectSource();
        docs.add("docs", "a.pdf", "v1", "first document", true);
        repository = new BackupRepository(db.jdbc);
        LedgerService ledger = new LedgerService(db.jdbc, db.tx, properties);
        ManifestService manifests = new ManifestService(new SigningKeys(properties));
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        backups = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new com.eqms.backup.agent.target.ReplicationService(new com.eqms.backup.agent.target.TargetRegistry(List.of()), repository, ledger), objects,
                () -> java.util.Optional.empty());
        scrub = new StoreScrubService(db.jdbc, docs, repository, properties, ledger);
        sha = sha256("first document");
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private static String sha256(String text) throws Exception {
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private void backup() {
        var out = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test", null, Set.of("DATABASE", "OBJECT_STORE")));
        assertThat(out.ok()).as(String.valueOf(out.errorDetail())).isTrue();
    }

    private Map<String, Object> run() {
        return scrub.run("MANUAL", "admin", percent -> { });
    }

    private void revision(String id, String key, String version, String checksum) throws Exception {
        try (Connection c = sourceConnection(); Statement s = c.createStatement()) {
            s.execute("insert into document_revisions(id, status_code, source_storage_bucket, source_storage_object_key, source_storage_version_id, source_file_checksum) values ('"
                    + id + "','EFFECTIVE','docs','" + key + "','" + version + "'" + (checksum == null ? ",null" : ",'" + checksum + "'") + ")");
        }
    }

    @Test
    void aStoreThatMatchesTheBackupAndTheSigningChecksumReportsNoDifference() throws Exception {
        backup();
        revision("r1", "a.pdf", "v1", sha);
        var out = run();
        assertThat(out).containsEntry("status", "COMPLETED").containsEntry("checkedFiles", 1L).containsEntry("differentFiles", 0).containsEntry("missingFiles", 0).containsEntry("referenceDifferences", 0);
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'STORE_SCRUB_MISMATCH'", Integer.class)).isZero();
    }

    @Test
    void sameSizeOtherContentIsFoundAndAlertedAndNothingIsChanged() throws Exception {
        backup();
        docs.content.put("docs/a.pdf@v1", "FIRST DOCUMENT".getBytes(StandardCharsets.UTF_8));
        var out = run();
        assertThat(out).containsEntry("differentFiles", 1);
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'STORE_SCRUB_MISMATCH' and severity = 'HIGH'", Integer.class)).isEqualTo(1);
        assertThat(new String(docs.content.get("docs/a.pdf@v1"), StandardCharsets.UTF_8)).isEqualTo("FIRST DOCUMENT");
        assertThat(db.jdbc.queryForObject("select detail_json::text from store_scrub_run", String.class)).contains("CONTENT").contains("a.pdf");
    }

    @Test
    void aDifferentSizeIsFoundWithoutReadingTheWholeFile() throws Exception {
        backup();
        docs.versions.clear();
        docs.add("docs", "a.pdf", "v1", "much longer than it was", true);
        int before = docs.opened;
        var out = run();
        assertThat(out).containsEntry("differentFiles", 1);
        assertThat(docs.opened).isEqualTo(before);
        assertThat(db.jdbc.queryForObject("select detail_json::text from store_scrub_run", String.class)).contains("SIZE");
    }

    @Test
    void aVersionTheBackupHoldsThatIsGoneFromTheStoreIsReportedAsMissing() throws Exception {
        backup();
        docs.versions.clear();
        var out = run();
        assertThat(out).containsEntry("missingFiles", 1).containsEntry("checkedFiles", 0L);
    }

    @Test
    void aVersionNotYetInAnyBackupIsNotADifference() throws Exception {
        backup();
        docs.add("docs", "new.pdf", "v1", "added after the backup", true);
        assertThat(run()).containsEntry("differentFiles", 0).containsEntry("missingFiles", 0);
    }

    @Test
    void theChecksumRecordedAtSigningCatchesAFileThatWasAlreadyDamagedBeforeItsFirstBackup() throws Exception {
        backup();
        revision("r1", "a.pdf", "v1", "f".repeat(64));
        var out = run();
        assertThat(out).containsEntry("referenceDifferences", 1).containsEntry("differentFiles", 0);
        assertThat(db.jdbc.queryForObject("select detail_json::text from store_scrub_run", String.class)).contains("recordedChecksum");
    }

    @Test
    void aFailedReadIsRecordedAsFailedAndTheNextRunIsNotBlocked() throws Exception {
        backup();
        docs.listFails = true;
        assertThatThrownBy(this::run).isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SCRUB_FAILED"));
        assertThat(db.jdbc.queryForObject("select status from store_scrub_run", String.class)).isEqualTo("FAILED");
        docs.listFails = false;
        assertThat(run()).containsEntry("status", "COMPLETED");
    }

    @Test
    void onlyOneRunAtATimeAndNoRunWithoutTheDocumentStore() throws Exception {
        db.jdbc.update("insert into store_scrub_run(trigger_kind, requested_by) values ('MANUAL', 'admin')");
        assertThatThrownBy(this::run).isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SCRUB_ALREADY_RUNNING"));
        db.jdbc.update("delete from store_scrub_run");
        properties.getObjects().setEnabled(false);
        assertThatThrownBy(this::run).isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SCRUB_OBJECTS_NOT_CONFIGURED"));
    }

    @Test
    void theRunsAreListedNewestFirstAndPagedOnTheServer() throws Exception {
        backup();
        run();
        run();
        @SuppressWarnings("unchecked")
        var page = (List<Map<String, Object>>) scrub.list(1, 1).get("data");
        assertThat(page).hasSize(1);
        assertThat(((Map<?, ?>) scrub.list(1, 1).get("pagination")).get("total")).isEqualTo(2L);
    }

    // ------------------------------------------------------------------ the reference check made when a backup is written

    @Test
    void aFileReferenceThatIsNotInTheIndexRaisesAWarningAtBackupTimeAndTheBackupIsStillValid() throws Exception {
        revision("r1", "a.pdf", "v1", sha);
        revision("r2", "missing.pdf", "v9", null);
        var out = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test", null, Set.of("DATABASE", "OBJECT_STORE")));
        assertThat(out.ok()).isTrue();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_REFERENCE_MISSING' and severity = 'WARNING'", Integer.class)).isEqualTo(1);
        assertThat(db.jdbc.queryForObject("select detail from backup_alert where code = 'BACKUP_REFERENCE_MISSING'", String.class)).contains("1 of 2").contains("missing.pdf");
    }

    @Test
    void whenEveryReferenceIsInTheIndexNothingIsRaised() throws Exception {
        revision("r1", "a.pdf", "v1", sha);
        backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test", null, Set.of("DATABASE", "OBJECT_STORE")));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_REFERENCE_MISSING'", Integer.class)).isZero();
    }

    @Test
    void aDatabaseOnlyBackupDoesNotCheckReferences() throws Exception {
        revision("r2", "missing.pdf", "v9", null);
        backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test", null, Set.of("DATABASE")));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_REFERENCE_MISSING'", Integer.class)).isZero();
    }
}
