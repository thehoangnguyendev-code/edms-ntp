package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.policy.PolicyView;
import com.eqms.backup.agent.target.BackupTarget;
import com.eqms.backup.agent.target.FolderTarget;
import com.eqms.backup.agent.target.ReplicationCatchUp;
import com.eqms.backup.agent.target.ReplicationService;
import com.eqms.backup.agent.target.TargetCatalog;
import com.eqms.backup.agent.target.TargetRegistry;
import com.eqms.backup.agent.target.TargetTester;
import com.eqms.backup.agent.verify.VerificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T2 is a network share (the NAS). It can be off the network when a backup finishes, or stop answering half way. The copy that was
 * missed must be made once the share answers again, an unreachable share must raise one alert, not one per attempt, and a share that
 * hangs must not stop the agent.
 */
class ReplicationCatchUpTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    BackupRepository repository;
    LedgerService ledger;
    OfflineCapableFolder t2;
    DatabaseBackupService service;
    PolicyView policy = new PolicyView(1, Set.of("DATABASE", "OBJECT_STORE"), Set.of("T1", "T2"));

    /** A folder that behaves like a share that is off the network, or one that never answers. */
    static final class OfflineCapableFolder implements BackupTarget {
        final FolderTarget inner;
        volatile boolean offline;
        volatile boolean hangs;

        OfflineCapableFolder(Path root) {
            this.inner = new FolderTarget("T2", root, false);
        }

        private void gate() throws IOException {
            if (hangs) {
                try {
                    Thread.sleep(30_000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("interrupted");
                }
            }
            if (offline) throw new IOException("The network path was not found");
        }

        @Override public String code() { return "T2"; }
        @Override public String kind() { return "FOLDER"; }
        @Override public boolean immutable() { return false; }
        @Override public String describe(String key) { return inner.describe(key); }
        @Override public void put(String key, Path file) throws IOException { gate(); inner.put(key, file); }
        @Override public void get(String key, Path destination) throws IOException { gate(); inner.get(key, destination); }
        @Override public boolean exists(String key) { return !offline && inner.exists(key); }
        @Override public boolean tryDelete(String key) throws IOException { gate(); return inner.tryDelete(key); }
        @Override public List<String> list(String prefix) throws IOException { gate(); return inner.list(prefix); }
    }

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

        FakeCommandRunner runner = new FakeCommandRunner();
        FakeObjectSource docs = new FakeObjectSource();
        docs.add("docs", "a.pdf", "v1", "first document", true);
        repository = new BackupRepository(db.jdbc);
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        ManifestService manifests = new ManifestService(new SigningKeys(properties));
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        t2 = new OfflineCapableFolder(tmp.resolve("nas"));
        service = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new ReplicationService(new TargetRegistry(List.of(t2)), repository, ledger), objects, () -> java.util.Optional.of(policy));
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private ReplicationCatchUp catchUp(long timeoutSeconds) {
        TargetCatalog catalog = new TargetCatalog(properties, new TargetRegistry(List.of(t2)));
        ReplicationService replication = new ReplicationService(new TargetRegistry(List.of(t2)), repository, ledger);
        return new ReplicationCatchUp(catalog, new TargetTester(), replication, repository, () -> java.util.Optional.of(policy), properties, timeoutSeconds);
    }

    private DatabaseBackupService.Outcome backup() {
        return service.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null));
    }

    private int confirmedCopies(String backupNumber, String target) {
        return db.jdbc.queryForObject("select count(*) from backup_set_location l join backup_run r on r.id = l.run_id "
                + "where r.backup_number = ? and l.target_code = ? and l.ok", Integer.class, backupNumber, target);
    }

    private int alerts(String code) {
        return db.jdbc.queryForObject("select count(*) from backup_alert where code = ?", Integer.class, code);
    }

    @Test
    void aCopyMissedWhileTheShareWasOffTheNetworkIsMadeWhenItAnswersAgain() throws Exception {
        t2.offline = true;
        DatabaseBackupService.Outcome outcome = backup();
        assertThat(outcome.ok()).as(String.valueOf(outcome.errorDetail())).isTrue();
        assertThat(confirmedCopies(outcome.backupNumber(), "T1")).isEqualTo(1);
        assertThat(confirmedCopies(outcome.backupNumber(), "T2")).isZero();
        assertThat(alerts("BACKUP_COPY_FAILED")).isEqualTo(1);

        ReplicationCatchUp catchUp = catchUp(5);
        assertThat(catchUp.run(Instant.now())).isZero();
        assertThat(catchUp.run(Instant.now())).isZero();
        assertThat(alerts("TARGET_UNREACHABLE")).as("one alert when the share goes away, none while it stays away").isEqualTo(1);
        assertThat(confirmedCopies(outcome.backupNumber(), "T2")).isZero();

        t2.offline = false;
        assertThat(catchUp.run(Instant.now())).isEqualTo(1);
        assertThat(confirmedCopies(outcome.backupNumber(), "T2")).isEqualTo(1);
        try (var files = Files.walk(tmp.resolve("nas"))) {
            assertThat(files.filter(Files::isRegularFile).map(p -> p.getFileName().toString())).contains("manifest.json");
        }
        assertThat(ledger.all()).anyMatch(e -> e.event().equals("BACKUP_COPIED") && e.dataJson().contains("late"));
        assertThat(catchUp.run(Instant.now())).as("nothing left to copy").isZero();
    }

    @Test
    void aShareThatNeverAnswersDoesNotBlockTheAgentAndIsAlerted() throws Exception {
        DatabaseBackupService.Outcome outcome = backup();
        assertThat(confirmedCopies(outcome.backupNumber(), "T2")).isEqualTo(1);

        t2.hangs = true;
        long started = System.nanoTime();
        assertThat(catchUp(1).run(Instant.now())).isZero();
        assertThat((System.nanoTime() - started) / 1_000_000_000.0).as("the pass gives up after its time limit").isLessThan(10);
        assertThat(alerts("TARGET_UNREACHABLE")).isEqualTo(1);
    }

    @Test
    void aBackupThatIsNotVerifiedOnT1IsNeverCopiedLate() throws Exception {
        t2.offline = true;
        DatabaseBackupService.Outcome outcome = backup();
        // the table is append-only; the throw-away test database lets the test pretend that the check never passed
        db.jdbc.execute("alter table backup_verification disable trigger user");
        db.jdbc.update("delete from backup_verification");
        t2.offline = false;
        assertThat(catchUp(5).run(Instant.now())).isZero();
        assertThat(confirmedCopies(outcome.backupNumber(), "T2")).isZero();
    }
}
