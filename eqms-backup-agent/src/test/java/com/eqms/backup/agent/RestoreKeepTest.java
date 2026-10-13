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
import com.eqms.backup.agent.policy.PolicyView;
import com.eqms.backup.agent.restore.RestoreKeepService;
import com.eqms.backup.agent.restore.RestoreKeyring;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A restore that keeps its database (SDS 11.3, R6-R7): the copy is kept and checked, and a refused backup leaves nothing behind. */
class RestoreKeepTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    BackupRepository repository;
    DatabaseBackupService backups;
    RehearsalRunner restoreRunner;
    RestoreKeepService keeps;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        String source = db.createSourceDb();
        AgentProperties properties = new AgentProperties();
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
        properties.getRestore().setDependencyEndpoints(List.of());

        runner = new FakeCommandRunner();
        docs = new FakeObjectSource();
        repository = new BackupRepository(db.jdbc);
        LedgerService ledger = new LedgerService(db.jdbc, db.tx, properties);
        SigningKeys keys = new SigningKeys(properties);
        ManifestService manifests = new ManifestService(keys);
        GpgKeyring gpg = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, gpg, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, gpg);
        objects.retryDelayMillis(1);
        PolicyView policy = new PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1"));
        backups = new DatabaseBackupService(properties, repository, ledger, manifests, runner, gpg, verification,
                new ReplicationService(new TargetRegistry(List.of()), repository, ledger), objects, () -> Optional.of(policy));
        restoreRunner = new RehearsalRunner(source, "jdbc:postgresql://" + db.host() + ":" + db.port() + "/postgres", db.user(), db.password());
        restoreRunner.secretKeys = List.of(FakeCommandRunner.SUBKEY_ID);
        RestoreKeyring ring = new RestoreKeyring(properties, restoreRunner);
        keeps = new RestoreKeepService(db.jdbc, ledger, repository, manifests, restoreRunner, ring, properties);
    }

    @AfterEach
    void tearDown() throws Exception {
        for (Map<String, Object> row : db.jdbc.queryForList("select db_name from restore_keep where status = 'READY'")) {
            try (java.sql.Connection c = java.sql.DriverManager.getConnection("jdbc:postgresql://" + db.host() + ":" + db.port() + "/postgres", db.user(), db.password());
                 java.sql.Statement st = c.createStatement()) {
                st.execute("drop database if exists \"" + row.get("db_name") + "\" with (force)");
            }
        }
        db.close();
    }

    private String backup() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        DatabaseBackupService.Outcome o = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "keep test", null));
        assertThat(o.ok()).as(String.valueOf(o.errorDetail())).isTrue();
        return o.backupNumber();
    }

    private boolean databaseExists(String name) {
        return db.jdbc.queryForObject("select count(*) from pg_database where datname = ?", Integer.class, name) > 0;
    }

    @Test
    void aVerifiedBackupIsKeptInItsOwnDatabaseAndChecked() {
        String backupNumber = backup();
        Map<String, Object> out = keeps.keep(backupNumber, "admin");
        String db1 = (String) out.get("database");
        assertThat(db1).startsWith("eqms_keep_");
        assertThat(databaseExists(db1)).as("the database is kept after the check, for a later swap").isTrue();
        assertThat(out.get("checks")).isInstanceOf(Map.class);
        assertThat(db.jdbc.queryForObject("select status from restore_keep where db_name = ?", String.class, db1)).isEqualTo("READY");
        assertThat(ledger().contains("RESTORE_KEEP_READY")).isTrue();
    }

    @Test
    void aBackupThatHasNotPassedItsCheckIsRefusedAndNothingIsCreated() {
        String backupNumber = backup();
        // the verification record is append-only: a newer FAILED check makes the latest result not VERIFIED
        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) "
                + "select id, 'V1', 'FAILED', '{}'::jsonb, now() + interval '1 minute', 'test' from backup_run where backup_number = ?", backupNumber);
        assertThatThrownBy(() -> keeps.keep(backupNumber, "admin"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RESTORE_KEEP_BACKUP_NOT_VERIFIED"));
        assertThat(db.jdbc.queryForObject("select count(*) from restore_keep", Integer.class)).isZero();
    }

    private List<String> ledger() {
        return db.jdbc.queryForList("select event from ledger_event", String.class);
    }
}
