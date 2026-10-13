package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.policy.PolicyView;
import com.eqms.backup.agent.restore.RestoreKeyring;
import com.eqms.backup.agent.restore.RestoreRehearsalService;
import com.eqms.backup.agent.target.ReplicationService;
import com.eqms.backup.agent.target.TargetRegistry;
import com.eqms.backup.agent.verify.VerificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Restore rehearsal (SDS 14.1 V2/V3, 14.3): a real scratch database is restored and checked, then dropped. */
class RestoreRehearsalTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    LedgerService ledger;
    BackupRepository repository;
    DatabaseBackupService backups;
    RehearsalRunner rehearsalRunner;
    RestoreRehearsalService rehearsals;
    InMemoryTestObjectStore testStore;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        String source = db.createSourceDb();
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
        properties.getRestore().setEnabled(true);
        properties.getRestore().setGnupgHome(Files.createDirectories(tmp.resolve("restore-gnupg")));
        Files.writeString(tmp.resolve("restore-gnupg").resolve("pubring.kbx"), "placeholder");
        properties.getRestore().setHost(db.host());
        properties.getRestore().setPort(db.port());
        properties.getRestore().setUser(db.user());
        properties.getRestore().setPassword(db.password());
        // no network probes in the unit test: C12 is checked by its own test
        properties.getRestore().setDependencyEndpoints(List.of());

        runner = new FakeCommandRunner();
        docs = new FakeObjectSource();
        repository = new BackupRepository(db.jdbc);
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        SigningKeys keys = new SigningKeys(properties);
        ManifestService manifests = new ManifestService(keys);
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        PolicyView policy = new PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1"));
        backups = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new ReplicationService(new TargetRegistry(List.of()), repository, ledger), objects, () -> Optional.of(policy));

        rehearsalRunner = new RehearsalRunner(source, "jdbc:postgresql://" + db.host() + ":" + db.port() + "/postgres", db.user(), db.password());
        rehearsalRunner.secretKeys = List.of(FakeCommandRunner.SUBKEY_ID);
        RestoreKeyring ring = new RestoreKeyring(properties, rehearsalRunner);
        testStore = new InMemoryTestObjectStore();
        rehearsals = new RestoreRehearsalService(db.jdbc, db.tx, ledger, repository, new JobQueue(db.jdbc), manifests, rehearsalRunner, ring, properties, testStore);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private String backup() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        docs.add("docs", "b.pdf", "v1", "second document", true);
        DatabaseBackupService.Outcome o = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null));
        assertThat(o.ok()).as(String.valueOf(o.errorDetail())).isTrue();
        assertThat(o.verification().verified()).isTrue();
        return o.backupNumber();
    }

    private Path envRoot() {
        return properties.getTargets().getT1().resolve("DEV");
    }

    private boolean scratchExists(String name) {
        return db.jdbc.queryForObject("select count(*) from pg_database where datname = ?", Integer.class, name) > 0;
    }

    private Map<String, Object> rehearse(String backupNumber) {
        Map<String, Object> queued = rehearsals.request(backupNumber, "tester.one", "Annual restore test");
        assertThat(queued).containsEntry("status", "QUEUED");
        return rehearsals.run((String) queued.get("rehearsalId"));
    }

    private Map<String, Boolean> checks(Map<String, Object> rehearsal) {
        Map<String, Boolean> out = new java.util.LinkedHashMap<>();
        for (Object o : (List<?>) rehearsal.get("checks")) {
            Map<?, ?> c = (Map<?, ?>) o;
            out.put((String) c.get("code"), (Boolean) c.get("ok"));
        }
        return out;
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    @Test
    void aVerifiedBackupIsRestoredIntoAScratchDatabaseChecked_and_dropped() {
        String backupNumber = backup();
        Map<String, Object> done = rehearse(backupNumber);

        assertThat(done).containsEntry("status", "PASSED");
        assertThat(done.get("errorCode")).isNull();
        Map<String, Boolean> c = checks(done);
        assertThat(c).containsEntry("MANIFEST_SIGNATURE", true).containsEntry("DECRYPTION_KEY", true).containsEntry("RESTORE_DATABASE", true)
                .containsEntry("C1", true).containsEntry("C2", true).containsEntry("C3", true).containsEntry("C4", true)
                .containsEntry("C6", true).containsEntry("C6_INDEX", true)
                .containsEntry("C13", true).containsEntry("C7", true);
        assertThat(scratchExists((String) done.get("scratchDb"))).as("the scratch database is dropped").isFalse();
        assertThat(testStore.exists(com.eqms.backup.agent.restore.RestoreObjectRestore.bucketFor("eqms-test-", (String) done.get("rehearsalId"))))
                .as("the throw-away bucket is removed").isFalse();
        assertThat(ledgerEvents()).containsSubsequence("RESTORE_REHEARSAL_REQUESTED", "RESTORE_REHEARSAL_STARTED", "RESTORE_REHEARSAL_PASSED");
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void theRequestIsRefusedForABackupThatIsNotCompletedOrNotVerified() {
        String backupNumber = backup();
        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) "
                + "select id, 'V1', 'FAILED', '{}'::jsonb, now() + interval '1 second', 'x' from backup_run where backup_number = ?", backupNumber);
        assertThatThrownBy(() -> rehearsals.request(backupNumber, "tester.one", "why")).isInstanceOfSatisfying(ExportException.class,
                e -> assertThat(e.code).isEqualTo("REHEARSAL_BACKUP_NOT_VERIFIED"));
        assertThatThrownBy(() -> rehearsals.request("BK-20200101-0000-0001", "tester.one", "why")).isInstanceOfSatisfying(ExportException.class,
                e -> assertThat(e.code).isEqualTo("BACKUP_NOT_FOUND"));
        assertThatThrownBy(() -> rehearsals.request(backupNumber, "tester.one", " ")).isInstanceOfSatisfying(ExportException.class,
                e -> assertThat(e.code).isEqualTo("REHEARSAL_REASON_REQUIRED"));
    }

    @Test
    void onlyOneRehearsalCanBeOpenAtATime() {
        String backupNumber = backup();
        rehearsals.request(backupNumber, "tester.one", "first");
        assertThatThrownBy(() -> rehearsals.request(backupNumber, "tester.two", "second")).isInstanceOfSatisfying(ExportException.class,
                e -> assertThat(e.code).isEqualTo("REHEARSAL_BUSY"));
    }

    @Test
    void aRestoreThatFailsIsRecordedWithACodeAlertedAndTheScratchDatabaseStillDropped() {
        String backupNumber = backup();
        rehearsalRunner.restoreFails = true;
        Map<String, Object> done = rehearse(backupNumber);

        assertThat(done).containsEntry("status", "FAILED").containsEntry("errorCode", "RESTORE_DATABASE_FAILED");
        assertThat(scratchExists((String) done.get("scratchDb"))).isFalse();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'RESTORE_REHEARSAL_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("RESTORE_REHEARSAL_FAILED");
    }

    @Test
    void aBackupWhoseKeyIsNotInTheRestoreRingIsNotAttempted() {
        String backupNumber = backup();
        rehearsalRunner.secretKeys = List.of();
        Map<String, Object> done = rehearse(backupNumber);
        assertThat(done).containsEntry("status", "FAILED").containsEntry("errorCode", "RESTORE_KEY_UNAVAILABLE");
        assertThat(rehearsalRunner.restoredInto).as("nothing was restored").isNull();
    }

    @Test
    void aRestoredDatabaseWithTheWrongRowCountFailsTheCheckAndTheRehearsal() {
        String backupNumber = backup();
        rehearsalRunner.afterRestore = s -> {
            try {
                s.execute("insert into documents(id, title) values (999, 'extra, not in the backup')");
            } catch (java.sql.SQLException e) {
                throw new IllegalStateException(e);
            }
        };
        Map<String, Object> done = rehearse(backupNumber);
        assertThat(done).containsEntry("status", "FAILED").containsEntry("errorCode", "REHEARSAL_CHECK_FAILED");
        assertThat(checks(done)).containsEntry("C2", false);
        assertThat(String.valueOf(done.get("errorDetail"))).contains("C2").contains("documents has 26 rows");
    }

    @Test
    void aSchemaVersionThatDiffersFromTheBackupFailsC1() {
        String backupNumber = backup();
        rehearsalRunner.afterRestore = s -> {
            try {
                s.execute("insert into flyway_schema_history values ('561')");
            } catch (java.sql.SQLException e) {
                throw new IllegalStateException(e);
            }
        };
        Map<String, Object> done = rehearse(backupNumber);
        assertThat(checks(done)).containsEntry("C1", false).containsEntry("C2", false);
    }

    @Test
    void aStoredDocumentThatNoLongerMatchesIsFoundByTheRehearsal() throws Exception {
        String backupNumber = backup();
        String blob = db.jdbc.queryForList("select blob_path from backup_object_blob order by id", String.class).get(0);
        Files.writeString(envRoot().resolve(blob), "FAKE-ENC|tampered content");
        Map<String, Object> done = rehearse(backupNumber);
        assertThat(done).containsEntry("status", "FAILED");
        assertThat(checks(done)).containsEntry("C6", false);
        assertThat(String.valueOf(done.get("errorDetail"))).contains("decrypts to different content");
    }

    @Test
    void theWeeklyV2CheckIsQueuedOnceSkipsWhileWaitingAndIsRecordedAsTierV2() {
        backup();
        var weekly = new com.eqms.backup.agent.restore.WeeklyV2Verification(db.jdbc, rehearsals, ledger, properties, repository, java.time.Clock.systemUTC());
        String rehearsalId = weekly.runOnce().orElseThrow();
        assertThat(weekly.runOnce()).as("a second check while the first waits is skipped").isEmpty();
        assertThat(ledgerEvents()).contains("SKIPPED_OVERLAP", "V2_REQUESTED");

        assertThat(rehearsals.run(rehearsalId)).containsEntry("status", "PASSED");
        Integer v2 = db.jdbc.queryForObject("select count(*) from backup_verification v join backup_run r on r.id = v.run_id "
                + "where v.tier = 'V2' and v.result = 'VERIFIED' and v.verified_by = 'system:V2'", Integer.class);
        assertThat(v2).isEqualTo(1);
    }

    @Test
    void aMissedWeeklyCheckIsRecordedWarnedAndRunOnceWhenTheWorkerIsBackAgain() {
        backup();
        properties.setRole("RESTORE_WORKER");
        var weekly = new com.eqms.backup.agent.restore.WeeklyV2Verification(db.jdbc, rehearsals, ledger, properties, repository, java.time.Clock.systemUTC());
        weekly.catchUp();
        assertThat(ledgerEvents()).contains("MISSED", "V2_REQUESTED");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_V2_MISSED'", Integer.class)).isEqualTo(1);
        weekly.catchUp();
        assertThat(ledgerEvents().stream().filter("MISSED"::equals).count()).as("the catch-up runs once, not on every tick").isEqualTo(1);
        properties.setRole("API");
    }

    @Test
    void theWorkerOnlyTakesRehearsalJobsAndTheApiOnlyTheOthers() {
        String backupNumber = backup();
        JobQueue queue = new JobQueue(db.jdbc);
        queue.enqueue("REHEARSAL", "{\"rehearsalId\":\"x\"}", "tester");
        queue.enqueue("BACKUP_DB", "{}", "tester");
        assertThat(queue.claimNext(5)).get().extracting(JobQueue.Job::type).isEqualTo("BACKUP_DB");
        assertThat(queue.claimNext(5, List.of("REHEARSAL"))).get().extracting(JobQueue.Job::type).isEqualTo("REHEARSAL");
        assertThat(backupNumber).startsWith("BK-");
    }

    @Test
    void aNewRehearsalIsListedWithItsChecksAndCanBeFiltered() {
        String backupNumber = backup();
        rehearse(backupNumber);
        assertThat(rehearsals.page(null, "PASSED", null, "requestedAt", false, 1, 10).total()).isEqualTo(1);
        assertThat(rehearsals.page(null, "FAILED", null, "requestedAt", false, 1, 10).total()).isZero();
        assertThat(rehearsals.page(null, null, backupNumber, "requestedAt", false, 1, 10).data()).hasSize(1);
        assertThat(rehearsals.page("tester.one", null, null, "requestedAt", false, 1, 10).total()).isEqualTo(1);
    }
}
