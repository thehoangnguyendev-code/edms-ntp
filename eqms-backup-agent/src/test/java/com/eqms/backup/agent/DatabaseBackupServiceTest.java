package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
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
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseBackupServiceTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    LedgerService ledger;
    DatabaseBackupService service;
    VerificationService verification;
    com.eqms.backup.agent.policy.PolicyView policy = new com.eqms.backup.agent.policy.PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1", "T2"));
    BackupRepository repository;
    FakeObjectSource docs;
    com.eqms.backup.agent.objects.ObjectBackupService objects;

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

        runner = new FakeCommandRunner();
        repository = new BackupRepository(db.jdbc);
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        ManifestService manifests = new ManifestService(new SigningKeys(properties));
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        docs = new FakeObjectSource();
        objects = new com.eqms.backup.agent.objects.ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        service = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification, new com.eqms.backup.agent.target.ReplicationService(new com.eqms.backup.agent.target.TargetRegistry(java.util.List.of()), repository, ledger), objects, () -> java.util.Optional.ofNullable(policy));
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private DatabaseBackupService.Request request() {
        return new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null);
    }

    private Path setDir(String backupNumber) throws Exception {
        try (Stream<Path> files = Files.walk(properties.getTargets().getT1())) {
            return files.filter(p -> p.getFileName().toString().equals(backupNumber)).findFirst().orElseThrow();
        }
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    @Test
    void aBackupWritesASignedEncryptedSetAndVerifiesIt() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());

        assertThat(outcome.ok()).as(String.valueOf(outcome.errorDetail())).isTrue();
        assertThat(outcome.verification().verified()).as(outcome.verification().checks().toString()).isTrue();
        assertThat(outcome.backupNumber()).matches("BK-\\d{8}-\\d{4}-0001");

        Path dir = setDir(outcome.backupNumber());
        assertThat(dir.resolve("database").resolve("eqms.dump.gpg")).exists();
        assertThat(dir.resolve("manifest.json")).exists();
        assertThat(dir.resolve("manifest.sig")).exists();
        assertThat(dir.resolve("SHA256SUMS")).exists();
        assertThat(dir.getParent().resolve(outcome.backupNumber() + ".partial")).doesNotExist();

        JsonNode manifest = new ObjectMapper().readTree(Files.readString(dir.resolve("manifest.json"), StandardCharsets.UTF_8));
        assertThat(manifest.path("schema").asText()).isEqualTo("eqms-backup-manifest/1");
        assertThat(manifest.path("components").get(0).path("rowCounts").path("documents").asLong()).isEqualTo(25);
        assertThat(manifest.path("components").get(0).path("rowCounts").path("audit_logs").asLong()).isEqualTo(40);
        assertThat(manifest.path("app").path("flywayLatest").asText()).isEqualTo("560");
        assertThat(manifest.path("previousManifestSha256").isNull()).isTrue();
        assertThat(manifest.path("encryption").path("recipientKeyId").asText()).hasSize(16);

        assertThat(ledgerEvents()).containsSubsequence("BACKUP_STARTED", "BACKUP_COMPLETED", "BACKUP_VERIFIED");
        assertThat(ledger.verify().ok()).isTrue();
        assertThat(db.jdbc.queryForObject("select status from backup_run where backup_number = ?", String.class, outcome.backupNumber())).isEqualTo("COMPLETED");
    }

    private DatabaseBackupService withTargets(com.eqms.backup.agent.target.BackupTarget... targets) throws Exception {
        ManifestService manifests = new ManifestService(new SigningKeys(properties));
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        com.eqms.backup.agent.target.ReplicationService replication = new com.eqms.backup.agent.target.ReplicationService(
                new com.eqms.backup.agent.target.TargetRegistry(List.of(targets)), repository, ledger);
        return new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification, replication, objects, () -> java.util.Optional.ofNullable(policy));
    }

    @Test
    void aVerifiedBackupIsCopiedToEveryExtraTargetAndEachCopyIsRecorded() throws Exception {
        var t2 = new com.eqms.backup.agent.target.FolderTarget("T2", tmp.resolve("t2"), false);
        DatabaseBackupService.Outcome outcome = withTargets(t2).run(request());

        assertThat(outcome.ok()).isTrue();
        String key = "DEV/" + outcome.backupNumber().substring(3, 7) + "/" + outcome.backupNumber().substring(7, 9) + "/" + outcome.backupNumber();
        assertThat(t2.list(key)).extracting(k -> k.substring(key.length() + 1)).containsExactlyInAnyOrder("database/eqms.dump.gpg", "manifest.json", "manifest.sig", "SHA256SUMS");
        assertThat(db.jdbc.queryForList("select target_code from backup_set_location l join backup_run r on r.id = l.run_id where r.backup_number = ? and l.ok order by 1", String.class, outcome.backupNumber()))
                .containsExactly("T1", "T2");
        assertThat(ledgerEvents()).contains("BACKUP_COPIED");
    }

    @Test
    void aCopyThatFailsLeavesTheBackupCompletedButRaisesAnAlertAndRecordsTheFailure() throws Exception {
        Files.writeString(tmp.resolve("blocker"), "a file, not a folder");
        var broken = new com.eqms.backup.agent.target.FolderTarget("T2", tmp.resolve("blocker").resolve("sub"), false);
        DatabaseBackupService.Outcome outcome = withTargets(broken).run(request());

        assertThat(outcome.ok()).isTrue();
        assertThat(db.jdbc.queryForObject("select status from backup_run where backup_number = ?", String.class, outcome.backupNumber())).isEqualTo("COMPLETED");
        assertThat(db.jdbc.queryForList("select l.ok from backup_set_location l join backup_run r on r.id = l.run_id where r.backup_number = ? and l.target_code = 'T2'", Boolean.class, outcome.backupNumber()))
                .containsExactly(false);
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'BACKUP_COPY_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("BACKUP_COPY_FAILED");
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void theSecondBackupFollowsTheFirstInTheChain() throws Exception {
        DatabaseBackupService.Outcome first = service.run(request());
        DatabaseBackupService.Outcome second = service.run(request());
        assertThat(second.ok()).isTrue();
        assertThat(second.backupNumber()).endsWith("-0002");
        String firstManifestSha = db.jdbc.queryForObject("select m.manifest_sha256 from backup_manifest m join backup_run r on r.id=m.run_id where r.backup_number=?", String.class, first.backupNumber());
        String previous = db.jdbc.queryForObject("select m.previous_manifest_sha256 from backup_manifest m join backup_run r on r.id=m.run_id where r.backup_number=?", String.class, second.backupNumber());
        assertThat(previous).isEqualTo(firstManifestSha);
        assertThat(second.verification().verified()).isTrue();
    }

    @Test
    void changingOneByteOfTheBackupFileIsFound() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());
        Path file = setDir(outcome.backupNumber()).resolve("database").resolve("eqms.dump.gpg");
        byte[] bytes = Files.readAllBytes(file);
        bytes[10] ^= 0x01;
        Files.write(file, bytes);

        VerificationService.Outcome again = verification.verifyV1(outcome.backupNumber(), "operator.one");
        assertThat(again.verified()).isFalse();
        assertThat(again.checks()).anyMatch(c -> c.code().equals("FILES_MATCH_MANIFEST") && !c.ok());
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code='BACKUP_VERIFY_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("BACKUP_VERIFY_FAILED");
        // the earlier good result is kept: results are history, never overwritten
        assertThat(db.jdbc.queryForObject("select count(*) from backup_verification where result='VERIFIED'", Integer.class)).isEqualTo(1);
    }

    @Test
    void editingTheManifestIsFoundByTheSignature() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());
        Path manifest = setDir(outcome.backupNumber()).resolve("manifest.json");
        Files.writeString(manifest, Files.readString(manifest).replace("\"environment\":\"DEV\"", "\"environment\":\"PROD\""));

        VerificationService.Outcome again = verification.verifyV1(outcome.backupNumber(), "operator.one");
        assertThat(again.verified()).isFalse();
        assertThat(again.checks()).anyMatch(c -> c.code().equals("MANIFEST_UNCHANGED") && !c.ok());
    }

    @Test
    void aForgedSignatureInTheDatabaseIsFound() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());
        db.jdbc.execute("alter table backup_manifest disable trigger user");
        db.jdbc.update("update backup_manifest set signature_base64 = ?", java.util.Base64.getEncoder().encodeToString(new byte[64]));
        db.jdbc.execute("alter table backup_manifest enable trigger user");
        assertThat(verification.verifyV1(outcome.backupNumber(), "operator.one").checks()).anyMatch(c -> c.code().equals("MANIFEST_SIGNATURE") && !c.ok());
    }

    @Test
    void aMissingBackupFolderIsFound() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());
        Path dir = setDir(outcome.backupNumber());
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        }
        VerificationService.Outcome again = verification.verifyV1(outcome.backupNumber(), "operator.one");
        assertThat(again.verified()).isFalse();
        assertThat(again.checks()).anyMatch(c -> c.code().equals("SET_PRESENT") && !c.ok());
    }

    @Test
    void aFileThatIsNotEncryptedToTheExpectedKeyIsFound() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());
        runner.packetsLookEncrypted = false;
        assertThat(verification.verifyV1(outcome.backupNumber(), "operator.one").checks()).anyMatch(c -> c.code().equals("ENCRYPTED_FOR_KEY") && !c.ok());
    }

    @Test
    void anAeadEncryptedFileIsAccepted() throws Exception {
        runner.aead = true;
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.verification().verified()).isTrue();
    }

    @Test
    void aBackupWhoseCompletionIsMissingFromTheLedgerIsFound() throws Exception {
        DatabaseBackupService.Outcome outcome = service.run(request());
        db.jdbc.execute("alter table ledger_event disable trigger user");
        db.jdbc.update("update ledger_event set ref = 'BK-other' where event = 'BACKUP_COMPLETED'");
        db.jdbc.execute("alter table ledger_event enable trigger user");
        assertThat(verification.verifyV1(outcome.backupNumber(), "operator.one").checks()).anyMatch(c -> c.code().equals("LEDGER_RECORDS_MANIFEST") && !c.ok());
    }

    @Test
    void whenTheDumpFailsNoValidSetExistsAndTheFailureIsRecordedEverywhere() throws Exception {
        runner.dumpFails = true;
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isFalse();
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_DUMP_FAILED");
        assertThat(db.jdbc.queryForObject("select status from backup_run where backup_number=?", String.class, outcome.backupNumber())).isEqualTo("FAILED");
        assertThat(db.jdbc.queryForObject("select error_code from backup_run where backup_number=?", String.class, outcome.backupNumber())).isEqualTo("BACKUP_DUMP_FAILED");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_manifest", Integer.class)).isZero();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code='BACKUP_DUMP_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("BACKUP_FAILED");
        try (Stream<Path> files = Files.walk(properties.getTargets().getT1())) {
            assertThat(files.map(p -> p.getFileName().toString())).noneMatch(n -> n.equals(outcome.backupNumber()));
        }
    }

    @Test
    void anUnwritableTargetStopsTheBackupBeforeAnyDataIsRead() throws Exception {
        Files.writeString(tmp.resolve("not-a-folder"), "x");
        properties.getTargets().setT1(tmp.resolve("not-a-folder"));
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_TARGET_UNAVAILABLE");
        assertThat(runner.pipelines).isZero();
    }

    @Test
    void notEnoughFreeSpaceStopsTheBackup() {
        properties.setMinFreeBytes(Long.MAX_VALUE / 2);
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_INSUFFICIENT_SPACE");
        assertThat(runner.pipelines).isZero();
    }

    @Test
    void aMissingEncryptionKeyStopsTheBackupAndNothingIsWrittenPlain() {
        runner.keyMissing = true;
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_ENCRYPTION_KEY_MISSING");
        assertThat(runner.pipelines).isZero();
    }

    @Test
    void aSecondBackupWhileOneIsRunningIsRefused() {
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-running', 'DEV', 'FULL', 'MANUAL', 'RUNNING', now(), 'someone')");
        DatabaseBackupService.Outcome outcome = service.run(request());
        assertThat(outcome.ok()).isFalse();
        assertThat(outcome.errorCode()).isEqualTo("BACKUP_ALREADY_RUNNING");
        assertThat(runner.pipelines).isZero();
    }

    @Test
    void aRunLeftRunningByADeadAgentIsClosedAsFailedAndDoesNotBlockTheNextBackup() {
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-stale', 'DEV', 'FULL', 'MANUAL', 'RUNNING', now() - interval '3 hours', 'someone')");
        assertThat(repository.failStaleRunning(java.time.Instant.now())).hasSize(1);
        assertThat(db.jdbc.queryForObject("select error_code from backup_run where backup_number='BK-stale'", String.class)).isEqualTo("AGENT_RESTARTED");
        assertThat(service.run(request()).ok()).isTrue();
    }

    @Test
    void recordsOfASetCannotBeEditedOrDeleted() {
        service.run(request());
        for (String table : List.of("backup_manifest", "backup_verification", "backup_component_result", "backup_set_location")) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> db.jdbc.update("delete from " + table))
                    .as(table).hasMessageContaining("append-only");
        }
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> db.jdbc.update("update backup_manifest set manifest_text = 'x'")).hasMessageContaining("append-only");
    }

    @Test
    void theListCanBeLimitedToADateRange() throws Exception {
        service.run(request());
        var queries = new com.eqms.backup.agent.api.BackupQueryService(db.jdbc);
        java.time.Instant now = java.time.Instant.now();
        var inside = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, now.minusSeconds(3600), now.plusSeconds(3600), null, null, "startedAt", false, 1, 10));
        var before = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, now.minusSeconds(3600), null, null, "startedAt", false, 1, 10));
        var after = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, now.plusSeconds(3600), null, null, null, "startedAt", false, 1, 10));
        assertThat(inside.total()).isEqualTo(1);
        assertThat(before.total()).isZero();
        assertThat(after.total()).isZero();
    }

    @Test
    void theListCanBeLimitedByWhenTheBackupWasLastChecked() throws Exception {
        var outcome = service.run(request());
        var queries = new com.eqms.backup.agent.api.BackupQueryService(db.jdbc);
        java.time.Instant now = java.time.Instant.now();
        var checkedNow = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, null, now.minusSeconds(600), now.plusSeconds(600), "verifiedAt", false, 1, 10));
        var checkedLongAgo = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, null, null, now.minusSeconds(600), "verifiedAt", false, 1, 10));
        assertThat(checkedNow.total()).isEqualTo(1);
        assertThat(checkedNow.data().get(0)).containsEntry("id", outcome.backupNumber());
        assertThat(checkedLongAgo.total()).isZero();
        // a backup that was never checked has no checked time, so a time range leaves it out instead of guessing
        db.jdbc.execute("alter table backup_verification disable trigger user");
        db.jdbc.update("delete from backup_verification");
        db.jdbc.execute("alter table backup_verification enable trigger user");
        assertThat(queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, null, now.minusSeconds(600), null, "verifiedAt", false, 1, 10)).total()).isZero();
        assertThat(queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, null, null, null, "verifiedAt", false, 1, 10)).total()).isEqualTo(1);
    }

    @Test
    void theScheduleRowsFilterByBackupTypeAndFrequency() {
        var schedules = new com.eqms.backup.agent.api.ScheduleQueryService(db.jdbc);
        assertThat(schedules.rows(null, null, "FULL", null, "component", true, 1, 10).get("data")).asList().hasSize(1);
        assertThat(schedules.rows(null, null, "INCREMENTAL", null, "component", true, 1, 10).get("data")).asList().isEmpty();
        assertThat(schedules.rows(null, null, null, "DAILY", "component", true, 1, 10).get("data")).asList().hasSize(1);
        assertThat(schedules.rows(null, null, null, "WEEKLY", "component", true, 1, 10).get("data")).asList().isEmpty();
        assertThat(schedules.rows(null, null, "ALL", "ALL", "component", true, 1, 10).get("data")).asList().hasSize(4);
        assertThat(schedules.rows(null, "ACTIVE", "FULL", "DAILY", "component", true, 1, 10).get("data")).asList().hasSize(1);
    }

    @Test
    void theScheduleIsListedPerComponentWithoutInventingAScheduleForTheOnesNotBackedUpYet() {
        var schedules = new com.eqms.backup.agent.api.ScheduleQueryService(db.jdbc);
        var all = schedules.rows(null, null, null, null, "component", true, 1, 10);
        assertThat(all.get("data")).asList().hasSize(4);
        @SuppressWarnings("unchecked")
        var rows = (java.util.List<java.util.Map<String, Object>>) all.get("data");
        assertThat(rows.get(0)).containsEntry("component", "DATABASE").containsEntry("status", "ACTIVE").containsEntry("time", "02:00").containsEntry("frequency", "DAILY");
        assertThat(rows.stream().skip(1)).allSatisfy(r -> assertThat(r).containsEntry("status", "NOT_SCHEDULED").containsEntry("time", ""));
    }

    @Test
    void theScheduleRowsFilterSortAndPageOnTheServer() {
        var schedules = new com.eqms.backup.agent.api.ScheduleQueryService(db.jdbc);
        @SuppressWarnings("unchecked")
        var active = (java.util.List<java.util.Map<String, Object>>) schedules.rows(null, "ACTIVE", null, null, "component", true, 1, 10).get("data");
        assertThat(active).hasSize(1);
        @SuppressWarnings("unchecked")
        var found = (java.util.List<java.util.Map<String, Object>>) schedules.rows("file_st", null, null, null, "component", true, 1, 10).get("data");
        assertThat(found).extracting(r -> r.get("component")).containsExactly("FILE_STORAGE");
        @SuppressWarnings("unchecked")
        var descending = (java.util.List<java.util.Map<String, Object>>) schedules.rows(null, null, null, null, "component", false, 1, 2).get("data");
        assertThat(descending).extracting(r -> r.get("component")).containsExactly("CONFIGURATION", "FILE_STORAGE");
        var hostile = schedules.rows("x'; drop table backup_policy; --", null, null, null, "nonsense; drop", true, 1, 1000);
        assertThat(((java.util.List<?>) hostile.get("data"))).isEmpty();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_policy", Integer.class)).isEqualTo(1);
    }

    @Test
    void aSwitchedOffScheduleShowsNothingAsActive() {
        db.jdbc.update("update backup_policy set schedule_json = '{\"database\":{\"enabled\":false}}'::jsonb");
        var schedules = new com.eqms.backup.agent.api.ScheduleQueryService(db.jdbc);
        @SuppressWarnings("unchecked")
        var rows = (java.util.List<java.util.Map<String, Object>>) schedules.rows(null, "ACTIVE", null, null, "component", true, 1, 10).get("data");
        assertThat(rows).isEmpty();
    }

    @Test
    void theApiReadModelFiltersSortsAndPagesInTheDatabase() throws Exception {
        for (int i = 0; i < 3; i++) service.run(request());
        runner.dumpFails = true;
        service.run(new DatabaseBackupService.Request("FULL", "MANUAL", "other.person", "broken one", null));

        var queries = new com.eqms.backup.agent.api.BackupQueryService(db.jdbc);
        var all = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, null, null, null, "startedAt", false, 1, 10));
        assertThat(all.total()).isEqualTo(4);
        var failed = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, "FAILED", null, null, null, null, null, null, "startedAt", false, 1, 10));
        assertThat(failed.total()).isEqualTo(1);
        var byPerson = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query("OTHER.per", null, null, null, null, null, null, null, "startedAt", false, 1, 10));
        assertThat(byPerson.total()).isEqualTo(1);
        var verified = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, "VERIFIED", null, null, null, null, "startedAt", false, 1, 10));
        assertThat(verified.total()).isEqualTo(3);
        var pageTwo = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query(null, null, null, null, null, null, null, null, "backupNumber", true, 2, 3));
        assertThat(pageTwo.data()).hasSize(1);
        var hostile = queries.list(new com.eqms.backup.agent.api.BackupQueryService.Query("x'; drop table backup_run; --", null, null, null, null, null, null, null, "startedAt; drop table backup_run", false, 1, 10));
        assertThat(hostile.total()).isZero();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_run", Integer.class)).isEqualTo(4);
        Map<String, Object> detail = queries.get(all.data().get(0).get("id").toString()).orElseThrow();
        assertThat(detail).containsKeys("components", "locations", "verifications");
        assertThat(detail).doesNotContainKey("_runId");
    }
}
