package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.objects.ObjectSource;
import com.eqms.backup.agent.target.BackupTarget;
import com.eqms.backup.agent.target.FolderTarget;
import com.eqms.backup.agent.target.ReplicationService;
import com.eqms.backup.agent.target.TargetRegistry;
import com.eqms.backup.agent.verify.VerificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/** The document-store half of a backup (SDS section 20.2): incremental by version, full view, retries, and what the check catches. */
class ObjectBackupTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    LedgerService ledger;
    com.eqms.backup.agent.policy.PolicyView policy = new com.eqms.backup.agent.policy.PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1", "T2"));
    BackupRepository repository;
    VerificationService verification;
    ManifestService manifests;
    GpgKeyring keyring;
    ObjectBackupService objects;
    DatabaseBackupService service;

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

        runner = new FakeCommandRunner();
        docs = new FakeObjectSource();
        repository = new BackupRepository(db.jdbc);
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        manifests = new ManifestService(new SigningKeys(properties));
        keyring = new GpgKeyring(properties, runner);
        verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        service = serviceWith();
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private DatabaseBackupService serviceWith(BackupTarget... targets) {
        return new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new ReplicationService(new TargetRegistry(List.of(targets)), repository, ledger), objects, () -> java.util.Optional.ofNullable(policy));
    }

    private DatabaseBackupService.Request request() {
        return new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null);
    }

    private Path envRoot() {
        return properties.getTargets().getT1().resolve("DEV");
    }

    private Path setDir(String backupNumber) throws Exception {
        try (Stream<Path> files = Files.walk(properties.getTargets().getT1())) {
            return files.filter(p -> p.getFileName().toString().equals(backupNumber)).findFirst().orElseThrow();
        }
    }

    private JsonNode manifest(String backupNumber) throws Exception {
        return new ObjectMapper().readTree(Files.readString(setDir(backupNumber).resolve("manifest.json"), StandardCharsets.UTF_8));
    }

    private List<String> blobPaths() {
        return db.jdbc.queryForList("select blob_path from backup_object_blob order by id", String.class);
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    @Test
    void aBackupStoresEachVersionEncryptedAndRecordsTheFullView() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        docs.add("docs", "b.pdf", "v1", "second document", true);
        DatabaseBackupService.Outcome outcome = service.run(request());

        assertThat(outcome.ok()).as(String.valueOf(outcome.errorDetail())).isTrue();
        assertThat(outcome.verification().verified()).as(outcome.verification().checks().toString()).isTrue();
        assertThat(outcome.verification().checks()).anyMatch(c -> c.code().equals("OBJECTS_PRESENT") && c.ok());
        assertThat(blobPaths()).hasSize(2);
        for (String blob : blobPaths()) assertThat(Files.readString(envRoot().resolve(blob))).startsWith("FAKE-ENC|");

        JsonNode manifest = manifest(outcome.backupNumber());
        JsonNode store = manifest.path("components").get(1);
        assertThat(store.path("key").asText()).isEqualTo("OBJECT_STORE");
        assertThat(store.path("versionCount").asLong()).isEqualTo(2);
        assertThat(store.path("newVersionCount").asLong()).isEqualTo(2);
        assertThat(manifest.path("objectListedAt").asText()).isNotEmpty();
        assertThat(manifest.path("components").get(0).path("file").asText()).isEqualTo("database/eqms.dump.gpg");
        assertThat(Files.readString(setDir(outcome.backupNumber()).resolve("SHA256SUMS"))).contains("objects/index.json.gpg");
        assertThat(db.jdbc.queryForObject("select object_count from backup_component_result r join backup_run u on u.id = r.run_id where u.backup_number = ? and component = 'OBJECT_STORE'",
                Long.class, outcome.backupNumber())).isEqualTo(2L);
    }

    @Test
    void aLaterBackupCopiesOnlyTheVersionsItHasNotStoredAndStillListsEverything() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        assertThat(service.run(request()).ok()).isTrue();
        assertThat(docs.opened).isEqualTo(1);

        docs.add("docs", "a.pdf", "v2", "first document, revised", true);
        DatabaseBackupService.Outcome second = service.run(request());
        assertThat(second.ok()).isTrue();
        assertThat(docs.opened).as("only the new version is read").isEqualTo(2);
        assertThat(blobPaths()).hasSize(2);
        JsonNode store = manifest(second.backupNumber()).path("components").get(1);
        assertThat(store.path("versionCount").asLong()).isEqualTo(2);
        assertThat(store.path("newVersionCount").asLong()).isEqualTo(1);
    }

    @Test
    void aDeleteMarkerIsListedButHasNoContent() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", false);
        docs.addDeleteMarker("docs", "a.pdf", "v2");
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isTrue();
        assertThat(blobPaths()).hasSize(1);
        JsonNode store = manifest(outcome.backupNumber()).path("components").get(1);
        assertThat(store.path("deleteMarkerCount").asLong()).isEqualTo(1);
        assertThat(store.path("versionCount").asLong()).isEqualTo(2);
    }

    @Test
    void aVersionStoredEarlierThatVanishedFromTheSourceIsReportedAndStillKept() throws Exception {
        ObjectSource.Version v1 = docs.add("docs", "a.pdf", "v1", "first document", true);
        assertThat(service.run(request()).ok()).isTrue();
        docs.versions.remove(v1);

        DatabaseBackupService.Outcome second = service.run(request());
        assertThat(second.ok()).isTrue();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'OBJECT_MISSING_IN_SOURCE'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("OBJECT_MISSING_IN_SOURCE");
        assertThat(blobPaths()).hasSize(1);
        assertThat(manifest(second.backupNumber()).path("components").get(1).path("versionCount").asLong()).as("the full view keeps it").isEqualTo(1);
    }

    @Test
    void aReadThatFailsTwiceIsRetriedAndSucceeds() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        docs.failReads = 2;
        assertThat(service.run(request()).ok()).isTrue();
        assertThat(docs.opened).isEqualTo(3);
    }

    @Test
    void aDocumentThatCannotBeReadFailsTheWholeBackupWithACodeAndRaisesAnAlert() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        docs.failReads = -1;
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isFalse();
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_OBJECT_READ_FAILED");
        assertThat(db.jdbc.queryForObject("select status from backup_run where backup_number = ?", String.class, outcome.backupNumber())).isEqualTo("FAILED");
        assertThat(blobPaths()).isEmpty();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_OBJECT_READ_FAILED'", Integer.class)).isEqualTo(1);
    }

    @Test
    void aStoreThatCannotBeListedFailsTheBackupBeforeAnythingIsCopied() {
        docs.listFails = true;
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isFalse();
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_SOURCE_UNAVAILABLE");
        assertThat(docs.opened).isZero();
    }

    @Test
    void anEncryptionFailureOnADocumentFailsTheBackupAndStoresNothing() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        runner.encryptFails = true;
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_ENCRYPTION_FAILED");
        assertThat(blobPaths()).isEmpty();
    }

    @Test
    void aSizeThatDiffersFromTheListingFailsTheBackup() {
        ObjectSource.Version v = docs.add("docs", "a.pdf", "v1", "first document", true);
        docs.versions.set(0, new ObjectSource.Version("docs", "a.pdf", "v1", v.size() + 5, false, true, v.lastModified()));
        assertThat(service.run(request()).errorCode()).isEqualTo("BACKUP_OBJECT_SIZE_MISMATCH");
    }

    @Test
    void enablingDocumentsWithoutABucketIsRefusedClearly() {
        properties.getObjects().setBuckets(List.of());
        assertThat(service.run(request()).errorCode()).isEqualTo("BACKUP_OBJECT_CONFIG");
    }

    @Test
    void aStoredDocumentThatWasAlteredOrRemovedIsCaughtByTheNextVerification() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        docs.add("docs", "b.pdf", "v1", "second document", true);
        DatabaseBackupService.Outcome first = service.run(request());
        assertThat(first.verification().verified()).isTrue();
        Files.delete(envRoot().resolve(blobPaths().get(0)));
        Files.writeString(envRoot().resolve(blobPaths().get(1)), "tampered!");

        VerificationService.Outcome again = verification.verifyV1(first.backupNumber(), "inspector");
        assertThat(again.verified()).isFalse();
        assertThat(again.checks()).anyMatch(c -> c.code().equals("OBJECTS_PRESENT") && !c.ok());
    }

    @Test
    void aBackupThatAddedNothingStillFailsWhenAnEarlierDocumentItDependsOnIsGone() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        DatabaseBackupService.Outcome first = service.run(request());
        docs.add("docs", "b.pdf", "v1", "second document", true);
        DatabaseBackupService.Outcome second = service.run(request());
        Files.delete(envRoot().resolve(blobPaths().get(0)));

        assertThat(verification.verifyV1(second.backupNumber(), "inspector").verified()).isFalse();
        assertThat(verification.verifyV1(first.backupNumber(), "inspector").verified()).isFalse();
    }

    @Test
    void aTargetAddedLaterCatchesUpWithEveryStoredDocumentOnTheNextBackup() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        assertThat(service.run(request()).ok()).isTrue();

        FolderTarget t2 = new FolderTarget("T2", tmp.resolve("t2"), false);
        docs.add("docs", "b.pdf", "v1", "second document", true);
        DatabaseBackupService.Outcome second = serviceWith(t2).run(request());
        assertThat(second.ok()).isTrue();
        assertThat(t2.list("DEV/objects")).hasSize(2);
        for (String blob : blobPaths()) assertThat(t2.exists("DEV/" + blob)).isTrue();
    }

    @Test
    void aStoredDocumentThatNoLongerMatchesIsNeverSentToAnotherTarget() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        assertThat(service.run(request()).ok()).isTrue();
        Files.writeString(envRoot().resolve(blobPaths().get(0)), "tampered!");

        FolderTarget t2 = new FolderTarget("T2", tmp.resolve("t2"), false);
        DatabaseBackupService.Outcome second = serviceWith(t2).run(request());
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_VERIFY_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(t2.list("DEV/objects")).isEmpty();
        assertThat(second.verification().verified()).isFalse();
    }

    @Test
    void theActivePolicyDecidesWhetherDocumentsAreBackedUp() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        policy = new com.eqms.backup.agent.policy.PolicyView(1, java.util.Set.of("DATABASE"), java.util.Set.of("T1"));
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isTrue();
        assertThat(docs.opened).isZero();
        assertThat(blobPaths()).isEmpty();
        assertThat(manifest(outcome.backupNumber()).path("components")).hasSize(1);
        assertThat(manifest(outcome.backupNumber()).path("policyVersion").asInt()).isEqualTo(1);
    }

    @Test
    void withNoActivePolicyOnlyTheDatabaseIsWrittenAndOnlyToT1() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        policy = null;
        FolderTarget t2 = new FolderTarget("T2", tmp.resolve("t2"), false);
        DatabaseBackupService.Outcome outcome = serviceWith(t2).run(request());
        assertThat(outcome.ok()).isTrue();
        assertThat(docs.opened).isZero();
        assertThat(t2.list("DEV")).isEmpty();
        assertThat(manifest(outcome.backupNumber()).path("policyVersion").isNull()).isTrue();
    }

    @Test
    void aTargetThatTheActivePolicyDoesNotListIsNotWrittenTo() throws Exception {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        policy = new com.eqms.backup.agent.policy.PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1"));
        FolderTarget t2 = new FolderTarget("T2", tmp.resolve("t2"), false);
        assertThat(serviceWith(t2).run(request()).ok()).isTrue();
        assertThat(t2.list("DEV")).isEmpty();
    }

    @Test
    void aTargetThePolicyNamesButTheAgentLacksIsAFailureToCopyNotASilentSkip() {
        policy = new com.eqms.backup.agent.policy.PolicyView(1, java.util.Set.of("DATABASE"), java.util.Set.of("T1", "T9"));
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isTrue();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_COPY_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(db.jdbc.queryForList("select l.ok from backup_set_location l where l.target_code = 'T9'", Boolean.class)).containsExactly(false);
    }
}
