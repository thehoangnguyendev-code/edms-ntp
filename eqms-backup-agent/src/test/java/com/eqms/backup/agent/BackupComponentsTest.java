package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.verify.VerificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/** The person chooses what a backup holds: the settings, the database, the files. Each part is optional; at least one is needed. */
class BackupComponentsTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    BackupRepository repository;
    DatabaseBackupService service;
    String source;

    private Connection sourceConnection() throws Exception {
        return DriverManager.getConnection("jdbc:postgresql://" + db.host() + ":" + db.port() + "/" + source, db.user(), db.password());
    }

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        source = db.createSourceDb();
        try (Connection c = sourceConnection(); Statement s = c.createStatement()) {
            s.execute("create table system_configurations(id serial primary key, k text)");
            s.execute("insert into system_configurations(k) values ('a'), ('b')");
            s.execute("create table roles(id serial primary key, name text)");
            s.execute("insert into roles(name) values ('QA')");
        }
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
        runner = new FakeCommandRunner();
        docs = new FakeObjectSource();
        docs.add("docs", "a.pdf", "v1", "first document", true);
        repository = new BackupRepository(db.jdbc);
        LedgerService ledger = new LedgerService(db.jdbc, db.tx, properties);
        ManifestService manifests = new ManifestService(new SigningKeys(properties));
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        service = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new com.eqms.backup.agent.target.ReplicationService(new com.eqms.backup.agent.target.TargetRegistry(List.of()), repository, ledger), objects,
                () -> java.util.Optional.empty());
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private DatabaseBackupService.Outcome run(String... components) {
        return service.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test", null, Set.of(components)));
    }

    private JsonNode manifest(String backupNumber) throws Exception {
        try (Stream<Path> files = Files.walk(properties.getTargets().getT1())) {
            Path dir = files.filter(p -> p.getFileName().toString().equals(backupNumber)).findFirst().orElseThrow();
            return new ObjectMapper().readTree(Files.readString(dir.resolve("manifest.json")));
        }
    }

    private List<String> keys(JsonNode manifest) {
        return manifest.path("components").findValuesAsText("key");
    }

    @Test
    void theRemovedSettingsPartIsRefusedWithItsOwnCodeAndWritesNothing() throws Exception {
        var out = run("CONFIGURATION");
        assertThat(out.ok()).isFalse();
        assertThat(out.errorCode()).isEqualTo("BACKUP_COMPONENT_REMOVED");
        assertThat(runner.dumpArgs).isEmpty();
        var withDatabase = run("DATABASE", "CONFIGURATION");
        assertThat(withDatabase.ok()).isFalse();
        assertThat(withDatabase.errorCode()).isEqualTo("BACKUP_COMPONENT_REMOVED");
    }

    @Test
    void databaseOnlyDumpsTheWholeDatabaseAndNoSettingsFile() throws Exception {
        var out = run("DATABASE");
        assertThat(out.ok()).isTrue();
        assertThat(keys(manifest(out.backupNumber()))).containsExactly("DATABASE");
        assertThat(runner.dumpArgs.get(0)).doesNotContain("-t");
    }

    @Test
    void filesOnlyWritesNoDatabaseDumpAndTakesItsTimeFromTheFileListing() throws Exception {
        var out = run("OBJECT_STORE");
        assertThat(out.ok()).as(String.valueOf(out.errorDetail())).isTrue();
        assertThat(out.verification().verified()).as(out.verification().checks().toString()).isTrue();
        JsonNode m = manifest(out.backupNumber());
        assertThat(keys(m)).containsExactly("OBJECT_STORE");
        assertThat(m.path("dbSnapshotAt").isNull()).isTrue();
        assertThat(runner.dumpArgs).isEmpty();
        assertThat(db.jdbc.queryForObject("select db_snapshot_at is not null from backup_run where backup_number = ?", Boolean.class, out.backupNumber())).isTrue();
    }

    @Test
    void bothPartsTogetherAreEachRecordedAndVerified() throws Exception {
        var out = run("DATABASE", "OBJECT_STORE");
        assertThat(out.ok()).as(String.valueOf(out.errorDetail())).isTrue();
        assertThat(out.verification().verified()).isTrue();
        assertThat(keys(manifest(out.backupNumber()))).containsExactlyInAnyOrder("DATABASE", "OBJECT_STORE");
        assertThat(db.jdbc.queryForList("select component from backup_component_result r join backup_run b on b.id = r.run_id where b.backup_number = ?", String.class, out.backupNumber()))
                .containsExactlyInAnyOrder("DATABASE", "OBJECT_STORE");
    }

    @Test
    void anUnknownPartIsRefusedAndWritesNothing() throws Exception {
        var out = run("DATABASE", "EVERYTHING");
        assertThat(out.ok()).isFalse();
        assertThat(out.errorCode()).isEqualTo("BACKUP_COMPONENT_UNKNOWN");
        assertThat(runner.dumpArgs).isEmpty();
    }

    @Test
    void noChoiceKeepsTheOldBehaviourOfTheDatabaseAloneWhenThereIsNoPolicy() throws Exception {
        var out = service.run(new DatabaseBackupService.Request("FULL", "SCHEDULED", "agent", "scheduled", null));
        assertThat(out.ok()).isTrue();
        assertThat(keys(manifest(out.backupNumber()))).containsExactly("DATABASE");
    }
}
