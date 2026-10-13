package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.export.ExportService;
import com.eqms.backup.agent.export.MediaService;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.target.ReplicationService;
import com.eqms.backup.agent.target.TargetRegistry;
import com.eqms.backup.agent.verify.VerificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Export Backup Set and the Offline Media Register (SDS 6.5). */
class ExportAndMediaTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    LedgerService ledger;
    BackupRepository repository;
    DatabaseBackupService backups;
    MediaService media;
    ExportService exports;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        String source = db.createSourceDb();
        properties = new AgentProperties();
        properties.setEnvironment("DEV");
        properties.setLedgerDir(tmp.resolve("ledger"));
        properties.getTargets().setT1(tmp.resolve("t1"));
        properties.getExports().setRoot(tmp.resolve("export"));
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
        SigningKeys keys = new SigningKeys(properties);
        ManifestService manifests = new ManifestService(keys);
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        var policy = new com.eqms.backup.agent.policy.PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1"));
        backups = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new ReplicationService(new TargetRegistry(List.of()), repository, ledger), objects, () -> java.util.Optional.of(policy));
        media = new MediaService(db.jdbc, db.tx, ledger);
        exports = new ExportService(db.jdbc, db.tx, ledger, repository, media, new JobQueue(db.jdbc), manifests, keys, properties);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private String backup() {
        if (docs.versions.isEmpty()) {
            docs.add("docs", "a.pdf", "v1", "first document", true);
            docs.add("docs", "b.pdf", "v1", "second document", true);
        }
        DatabaseBackupService.Outcome o = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null));
        assertThat(o.ok()).as(String.valueOf(o.errorDetail())).isTrue();
        assertThat(o.verification().verified()).isTrue();
        return o.backupNumber();
    }

    private UUID usb(String label) {
        Map<String, Object> m = media.register(new MediaService.Registration(label, "SN-" + label, "USB", 10_000_000L, "dir-" + label.toLowerCase(), "2030-01-01", "custodian.one"));
        return UUID.fromString((String) m.get("id"));
    }

    private Map<String, Object> approvedExport(String backupNumber, UUID mediaId) {
        Map<String, Object> requested = exports.request(backupNumber, mediaId, "Weekly off-site copy", "operator.one");
        return exports.approve((String) requested.get("exportId"), "approver.two");
    }

    private void refused(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo(code));
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    private List<String> filesIn(Path dir) throws Exception {
        try (Stream<Path> walk = Files.walk(dir)) {
            return walk.filter(Files::isRegularFile).map(p -> dir.relativize(p).toString().replace('\\', '/')).sorted().toList();
        }
    }

    // ------------------------------------------------------------------ the register

    @Test
    void aMediumIsRegisteredWithItsIdentityAndStartsAvailable() {
        Map<String, Object> m = media.register(new MediaService.Registration("USB-01", "SN123", "usb", 5_000_000L, "usb-01", "2030-06-30", "custodian.one"));
        assertThat(m).containsEntry("label", "USB-01").containsEntry("kind", "USB").containsEntry("status", "AVAILABLE").containsEntry("exportDir", "usb-01").containsEntry("expiresOn", "2030-06-30");
        assertThat(media.events(UUID.fromString((String) m.get("id")))).extracting(e -> e.get("event")).containsExactly("REGISTERED");
        assertThat(ledgerEvents()).contains("MEDIA_REGISTERED");
    }

    @Test
    void aBadRegistrationIsRefusedWithAStableCode() {
        refused(() -> media.register(new MediaService.Registration("", "S", "USB", 1, "a", null, "x")), "MEDIA_LABEL_REQUIRED");
        refused(() -> media.register(new MediaService.Registration("L", "", "USB", 1, "a", null, "x")), "MEDIA_SERIAL_REQUIRED");
        refused(() -> media.register(new MediaService.Registration("L", "S", "FLOPPY", 1, "a", null, "x")), "MEDIA_KIND");
        refused(() -> media.register(new MediaService.Registration("L", "S", "USB", 0, "a", null, "x")), "MEDIA_CAPACITY");
        refused(() -> media.register(new MediaService.Registration("L", "S", "USB", 1, "../escape", null, "x")), "MEDIA_EXPORT_DIR");
        refused(() -> media.register(new MediaService.Registration("L", "S", "USB", 1, "..", null, "x")), "MEDIA_EXPORT_DIR");
        refused(() -> media.register(new MediaService.Registration("L", "S", "USB", 1, "a/b", null, "x")), "MEDIA_EXPORT_DIR");
        refused(() -> media.register(new MediaService.Registration("L", "S", "USB", 1, "a", "next year", "x")), "MEDIA_EXPIRY");
        refused(() -> media.register(new MediaService.Registration("L", "S", "USB", 1, "a", null, " ")), "PERSON_REQUIRED");
    }

    @Test
    void aDuplicateLabelOrFolderIsRefused() {
        usb("USB-01");
        refused(() -> media.register(new MediaService.Registration("USB-01", "other", "USB", 1, "elsewhere", null, "x")), "MEDIA_DUPLICATE");
        refused(() -> media.register(new MediaService.Registration("USB-02", "other", "USB", 1, "dir-usb-01", null, "x")), "MEDIA_DUPLICATE");
    }

    @Test
    void theRegisterPagesFiltersAndSearchesOnTheServer() {
        usb("USB-01");
        usb("USB-02");
        usb("TAPE-9");
        assertThat(media.page(null, null, null, "label", true, 1, 2).total()).isEqualTo(3);
        assertThat(media.page(null, null, null, "label", true, 2, 2).data()).hasSize(1);
        assertThat(media.page("tape", null, null, "label", true, 1, 10).data()).extracting(m -> m.get("label")).containsExactly("TAPE-9");
        assertThat(media.page("100%", null, null, "label", true, 1, 10).total()).isZero();
        assertThat(media.page(null, "RETIRED", null, "label", true, 1, 10).total()).isZero();
    }

    // ------------------------------------------------------------------ requesting and approving

    @Test
    void anExportNeedsAVerifiedBackupAnAvailableMediumAndAReason() {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        refused(() -> exports.request(backupNumber, m, " ", "operator.one"), "EXPORT_REASON_REQUIRED");
        refused(() -> exports.request("BK-20200101-0000-0001", m, "why", "operator.one"), "BACKUP_NOT_FOUND");
        refused(() -> exports.request(backupNumber, UUID.randomUUID(), "why", "operator.one"), "MEDIA_NOT_FOUND");

        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) "
                + "select id, 'V1', 'FAILED', '{}'::jsonb, now() + interval '1 second', 'x' from backup_run where backup_number = ?", backupNumber);
        refused(() -> exports.request(backupNumber, m, "why", "operator.one"), "EXPORT_BACKUP_NOT_VERIFIED");
    }

    @Test
    void aMediumThatIsTooSmallOrNotAvailableOrAlreadyBusyIsRefused() {
        String backupNumber = backup();
        UUID tiny = UUID.fromString((String) media.register(new MediaService.Registration("TINY", "S", "USB", 100, "tiny", null, "c")).get("id"));
        refused(() -> exports.request(backupNumber, tiny, "why", "operator.one"), "EXPORT_MEDIA_TOO_SMALL");

        UUID m = usb("USB-01");
        exports.request(backupNumber, m, "first", "operator.one");
        refused(() -> exports.request(backupNumber, m, "second", "operator.one"), "EXPORT_MEDIA_BUSY");

        UUID retired = usb("OLD");
        media.retire(retired, "Shredded, certificate 77", "custodian.one");
        refused(() -> exports.request(backupNumber, retired, "why", "operator.one"), "EXPORT_MEDIA_NOT_AVAILABLE");
    }

    @Test
    void theApproverMustBeAnotherPersonAndTheRefusalIsRecorded() {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        String id = (String) exports.request(backupNumber, m, "why", "Operator.One").get("exportId");
        assertThatThrownBy(() -> exports.approve(id, "operator.one")).isInstanceOfSatisfying(ExportException.class, e -> {
            assertThat(e.code).isEqualTo("EXPORT_SAME_PERSON");
            assertThat(e.kind).isEqualTo(ExportException.Kind.SEPARATION);
        });
        assertThat(exports.get(id)).containsEntry("status", "REQUESTED");
        assertThat(ledgerEvents()).contains("BACKUP_EXPORT_REFUSED");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job where job_type = 'EXPORT'", Integer.class)).isZero();
    }

    @Test
    void approvingQueuesTheJobAndRejectingFreesTheMedium() {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        String id = (String) exports.request(backupNumber, m, "why", "operator.one").get("exportId");
        assertThat(exports.approve(id, "approver.two")).containsEntry("status", "APPROVED").containsEntry("approvedBy", "approver.two");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job where job_type = 'EXPORT' and status = 'QUEUED'", Integer.class)).isEqualTo(1);
        refused(() -> exports.approve(id, "third.person"), "EXPORT_STATE");

        UUID m2 = usb("USB-02");
        String id2 = (String) exports.request(backupNumber, m2, "why", "operator.one").get("exportId");
        refused(() -> exports.reject(id2, "approver.two", " "), "EXPORT_REASON_REQUIRED");
        assertThat(exports.reject(id2, "approver.two", "Wrong medium")).containsEntry("status", "REJECTED");
        assertThat(exports.request(backupNumber, m2, "again", "operator.one")).containsEntry("status", "REQUESTED");
    }

    @Test
    void inProductionAnExportFolderOnTheSameDiskAsT1IsRefused() {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        properties.setEnvironment("PROD");
        refused(() -> exports.request(backupNumber, m, "why", "operator.one"), "EXPORT_SAME_DISK");
    }

    @Test
    void inDevTheSameDiskIsAllowedAndSaidSoInTheRecord() {
        String backupNumber = backup();
        Map<String, Object> requested = exports.request(backupNumber, usb("USB-01"), "why", "operator.one");
        assertThat((String) requested.get("notes")).contains("sameDiskAsT1");
    }

    // ------------------------------------------------------------------ building the package

    @Test
    void aPackageHoldsEverythingTheBackupNeedsAndIsClosedByASignedReceipt() throws Exception {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        Map<String, Object> approved = approvedExport(backupNumber, m);
        Map<String, Object> done = exports.run((String) approved.get("exportId"), "agent");

        assertThat(done).containsEntry("status", "COMPLETED");
        Path pkg = Path.of((String) done.get("packagePath"));
        assertThat(pkg.getFileName().toString()).startsWith("EXPORT-" + backupNumber + "-");
        List<String> files = filesIn(pkg);
        assertThat(files).contains("README-RESTORE.txt", "manifest.json", "manifest.sig", "SHA256SUMS", "PACKAGE-SHA256SUMS", "EXPORT-RECEIPT.json", "EXPORT-RECEIPT.sig",
                "database/eqms.dump.gpg", "objects/index.json.gpg", "tools/verify-chain.sh", "tools/verify-chain.ps1", "public-keys/manifest-signing.pub");
        assertThat(files.stream().filter(f -> f.startsWith("objects/docs/"))).hasSize(2);
        assertThat(done.get("fileCount")).isEqualTo(files.size());
        assertThat((String) done.get("receiptSha256")).hasSize(64);

        // every readable file is listed with its checksum, and the receipt names that list
        String sums = Files.readString(pkg.resolve("PACKAGE-SHA256SUMS"));
        assertThat(sums).contains("manifest.json").contains("tools/verify-chain.sh").doesNotContain("EXPORT-RECEIPT");
        assertThat(Files.readString(pkg.resolve("EXPORT-RECEIPT.json"))).contains("\"packageSumsSha256\":\"" + ManifestService.sha256(sums) + "\"");

        assertThat(media.get(m)).containsEntry("status", "IN_TRANSIT").containsEntry("packageCount", 1L);
        assertThat(ledgerEvents()).containsSubsequence("BACKUP_EXPORT_REQUESTED", "BACKUP_EXPORT_APPROVED", "BACKUP_EXPORTED");
        assertThat(ledger.verify().ok()).isTrue();
        assertThat(filesIn(pkg.getParent())).noneMatch(f -> f.contains(".partial"));
    }

    @Test
    void thePackageCanBeCheckedWithoutTheSoftwareAndTamperingIsCaught() throws Exception {
        Assumptions.assumeTrue(tool("sh") && tool("openssl") && tool("sha256sum") && tool("base64"), "sh, openssl, sha256sum and base64 are needed");
        String backupNumber = backup();
        Map<String, Object> done = exports.run((String) approvedExport(backupNumber, usb("USB-01")).get("exportId"), "agent");
        Path pkg = Path.of((String) done.get("packagePath"));

        assertThat(verifyChain(pkg)).as("a good package passes").isZero();

        Path dump = pkg.resolve("database/eqms.dump.gpg");
        byte[] original = Files.readAllBytes(dump);
        Files.writeString(dump, "changed", StandardCharsets.UTF_8);
        assertThat(verifyChain(pkg)).as("a changed file is caught").isNotZero();
        Files.write(dump, original);
        assertThat(verifyChain(pkg)).isZero();

        Path manifest = pkg.resolve("manifest.json");
        String text = Files.readString(manifest);
        Files.writeString(manifest, text.replace("DEV", "PRD"));
        assertThat(verifyChain(pkg)).as("a changed manifest is caught").isNotZero();
    }

    @Test
    void aStoredDocumentThatNoLongerMatchesMakesThePackageInvalidAndRaisesAnAlert() throws Exception {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        Map<String, Object> approved = approvedExport(backupNumber, m);
        String blob = db.jdbc.queryForList("select blob_path from backup_object_blob order by id", String.class).get(0);
        Files.writeString(properties.getTargets().getT1().resolve("DEV").resolve(blob), "tampered");

        Map<String, Object> done = exports.run((String) approved.get("exportId"), "agent");
        assertThat(done).containsEntry("status", "INVALID").containsEntry("errorCode", "EXPORT_COPY_MISMATCH");
        assertThat(media.get(m)).containsEntry("status", "AVAILABLE");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'EXPORT_COPY_MISMATCH'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("BACKUP_EXPORT_FAILED");
        try (Stream<Path> top = Files.list(properties.getExports().getRoot().resolve("dir-usb-01"))) {
            assertThat(top.map(p -> p.getFileName().toString())).allMatch(n -> n.endsWith(".invalid"));
        }
    }

    @Test
    void aRunIsRefusedUnlessTheExportWasApproved() {
        String backupNumber = backup();
        String id = (String) exports.request(backupNumber, usb("USB-01"), "why", "operator.one").get("exportId");
        refused(() -> exports.run(id, "agent"), "EXPORT_STATE");
    }

    @Test
    void aSecondPackageWithTheSameNameOnTheSameMediumIsNotOverwritten() {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        Map<String, Object> first = exports.run((String) approvedExport(backupNumber, m).get("exportId"), "agent");
        assertThat(first).containsEntry("status", "COMPLETED");
        db.jdbc.update("update offline_media set status = 'AVAILABLE' where id = ?", m);
        Map<String, Object> second = exports.run((String) approvedExport(backupNumber, m).get("exportId"), "agent");
        assertThat(second).containsEntry("status", "INVALID").containsEntry("errorCode", "EXPORT_PACKAGE_EXISTS");
    }

    // ------------------------------------------------------------------ the medium's life

    private UUID exportedMedium() {
        String backupNumber = backup();
        UUID m = usb("USB-01");
        exports.run((String) approvedExport(backupNumber, m).get("exportId"), "agent");
        return m;
    }

    @Test
    void aMediumInTransitIsReceivedOnlyAfterAHandoverAndByAnotherPerson() {
        UUID m = exportedMedium();
        refused(() -> media.receive(m, "keeper.three"), "MEDIA_NOT_HANDED_OVER");
        refused(() -> media.handover(m, " ", "Safe 2", "courier.one"), "MEDIA_HOLDER_REQUIRED");
        media.handover(m, "Ms Keeper", "Bank vault, box 12", "courier.one");
        assertThatThrownBy(() -> media.receive(m, "Courier.One")).isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.kind).isEqualTo(ExportException.Kind.SEPARATION));
        Map<String, Object> stored = media.receive(m, "keeper.three");
        assertThat(stored).containsEntry("status", "STORED_OFFSITE").containsEntry("holder", "Ms Keeper").containsEntry("storageLocation", "Bank vault, box 12");
        assertThat(media.events(m)).extracting(e -> e.get("event")).containsExactly("RECEIVED", "HANDED_OVER", "EXPORTED", "REGISTERED");
        assertThat(media.packages(m)).hasSize(1);
        refused(() -> media.handover(m, "x", "y", "courier.one"), "MEDIA_STATE");
    }

    @Test
    void aFailedReadTestQuarantinesTheMediumAndAlerts() {
        UUID m = exportedMedium();
        media.handover(m, "Ms Keeper", "Vault", "courier.one");
        media.receive(m, "keeper.three");
        refused(() -> media.readTest(m, "MAYBE", "x", "custodian.one"), "MEDIA_READ_TEST_RESULT");
        assertThat(media.readTest(m, "PASSED", "Ran verify-chain.sh, all OK", "custodian.one")).containsEntry("status", "STORED_OFFSITE").containsEntry("lastReadTestResult", "PASSED");
        assertThat(media.readTest(m, "FAILED", "Read errors on sector 7", "custodian.one")).containsEntry("status", "QUARANTINED");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'MEDIA_READ_FAILED'", Integer.class)).isEqualTo(1);
        assertThat(media.readTest(m, "PASSED", "Re-read after cleaning", "custodian.one")).containsEntry("status", "STORED_OFFSITE");
    }

    @Test
    void recyclingNeedsAWipeConfirmationAndForgetsTheOldPackages() {
        UUID m = exportedMedium();
        refused(() -> media.recycle(m, true, "reuse", "custodian.one"), "MEDIA_STATE");
        media.handover(m, "Ms Keeper", "Vault", "courier.one");
        media.receive(m, "keeper.three");
        refused(() -> media.recycle(m, false, "reuse", "custodian.one"), "MEDIA_WIPE_UNCONFIRMED");
        refused(() -> media.recycle(m, true, " ", "custodian.one"), "MEDIA_REASON_REQUIRED");
        assertThat(media.recycle(m, true, "Rotation: newer copy is stored", "custodian.one")).containsEntry("status", "AVAILABLE").containsEntry("packageCount", 0L).containsEntry("holder", null);
        assertThat(media.packages(m)).isEmpty();
    }

    @Test
    void aMediumHoldingLegalHoldDataCanNeitherBeRecycledNorDestroyed() {
        UUID m = exportedMedium();
        media.handover(m, "Ms Keeper", "Vault", "courier.one");
        media.receive(m, "keeper.three");
        db.jdbc.update("update offline_media set holds_legal_hold = true where id = ?", m);
        refused(() -> media.recycle(m, true, "reuse", "custodian.one"), "MEDIA_LEGAL_HOLD");
        refused(() -> media.retire(m, "Shredded", "custodian.one"), "MEDIA_LEGAL_HOLD");
    }

    @Test
    void retiringNeedsADestructionRecordAndIsFinal() {
        UUID m = exportedMedium();
        refused(() -> media.retire(m, "Shredded", "custodian.one"), "MEDIA_STATE");
        media.handover(m, "Ms Keeper", "Vault", "courier.one");
        media.receive(m, "keeper.three");
        refused(() -> media.retire(m, " ", "custodian.one"), "MEDIA_DESTRUCTION_RECORD");
        assertThat(media.retire(m, "Shredded by vendor, certificate 77", "custodian.one")).containsEntry("status", "RETIRED").containsEntry("destructionRecord", "Shredded by vendor, certificate 77");
        refused(() -> media.retire(m, "again", "custodian.one"), "MEDIA_STATE");
    }

    @Test
    void theEstimateCountsTheDatabaseTheIndexAndEveryStoredDocument() {
        String backupNumber = backup();
        Map<String, Object> estimate = exports.estimate(backupNumber);
        assertThat(((Number) estimate.get("estimatedBytes")).longValue()).isGreaterThan(0);
        assertThat(((Number) estimate.get("fileCount")).intValue()).isGreaterThanOrEqualTo(2 + 2 + 6);
    }

    @Test
    void theExportListPagesFiltersAndSearchesOnTheServer() {
        String backupNumber = backup();
        exports.request(backupNumber, usb("USB-01"), "one", "operator.one");
        exports.request(backupNumber, usb("USB-02"), "two", "operator.one");
        assertThat(exports.page(null, null, null, "requestedAt", false, 1, 1).total()).isEqualTo(2);
        assertThat(exports.page("usb-02", null, null, "requestedAt", false, 1, 10).data()).hasSize(1);
        assertThat(exports.page(null, "COMPLETED", null, "requestedAt", false, 1, 10).total()).isZero();
        assertThat(exports.page(null, null, backupNumber, "media", true, 1, 10).data()).extracting(e -> e.get("mediaLabel")).containsExactly("USB-01", "USB-02");
        assertThat(exports.page(null, null, null, "requestedAt", false, 1, 1000).limit()).isEqualTo(100);
    }

    // ------------------------------------------------------------------ tools

    private static boolean tool(String name) {
        try {
            return new ProcessBuilder(name, "--version").redirectErrorStream(true).start().waitFor() >= 0;
        } catch (Exception e) {
            return false;
        }
    }

    private int verifyChain(Path pkg) throws Exception {
        Process p = new ProcessBuilder("sh", "tools/verify-chain.sh", ".").directory(pkg.toFile()).redirectErrorStream(true).start();
        p.getInputStream().readAllBytes();
        return p.waitFor();
    }
}
