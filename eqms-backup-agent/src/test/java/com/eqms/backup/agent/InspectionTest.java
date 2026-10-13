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
import com.eqms.backup.agent.restore.InspectionService;
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
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Backup Inspection, phase 1 (SDS 7.2): a read-only copy for five minutes, asked and approved by different people. */
class InspectionTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    LedgerService ledger;
    BackupRepository repository;
    DatabaseBackupService backups;
    RehearsalRunner restoreRunner;
    InspectionService inspections;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        // the reader role is provisioned once per server by a database administrator (scripts/backup/inspection-reader-role.sql)
        db.jdbc.execute("do $$ begin if not exists (select 1 from pg_roles where rolname = 'eqms_inspect_reader') then "
                + "create role eqms_inspect_reader nologin; end if; end $$");
        db.jdbc.execute("grant eqms_inspect_reader to \"" + db.user() + "\"");
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

        restoreRunner = new RehearsalRunner(source, "jdbc:postgresql://" + db.host() + ":" + db.port() + "/postgres", db.user(), db.password());
        restoreRunner.secretKeys = List.of(FakeCommandRunner.SUBKEY_ID);
        RestoreKeyring ring = new RestoreKeyring(properties, restoreRunner);
        inspections = new InspectionService(db.jdbc, db.tx, ledger, repository, new JobQueue(db.jdbc), manifests, restoreRunner, ring, properties);
    }

    /** The copies this test opened: a test that fails before closing its copy must not leave it for the next test. */
    private final List<String> opened = new java.util.ArrayList<>();

    private Map<String, Object> open(String inspectionId) {
        opened.add(inspectionId.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]", "_"));
        return inspections.open(inspectionId);
    }

    @AfterEach
    void tearDown() throws Exception {
        try (java.sql.Connection admin = java.sql.DriverManager.getConnection("jdbc:postgresql://" + db.host() + ":" + db.port() + "/postgres", db.user(), db.password());
             java.sql.Statement st = admin.createStatement()) {
            for (String suffix : opened) {
                st.execute("drop database if exists \"inspect_" + suffix + "\" with (force)");
            }
        }
        db.close();
    }

    private String backup() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        DatabaseBackupService.Outcome o = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null));
        assertThat(o.ok()).as(String.valueOf(o.errorDetail())).isTrue();
        assertThat(o.verification().verified()).isTrue();
        return o.backupId();
    }

    private boolean databaseExists(String name) {
        return db.jdbc.queryForObject("select count(*) from pg_database where datname = ?", Integer.class, name) > 0;
    }

    private boolean roleExists(String name) {
        return db.jdbc.queryForObject("select count(*) from pg_roles where rolname = ?", Integer.class, name) > 0;
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    private String approvedInspection(String backupId) {
        String id = (String) inspections.request(backupId, "requester.one", "Look at revision 164 before the audit").get("inspectionId");
        inspections.approve(id, "approver.one", "SIG-INSPECTION-1");
        return id;
    }

    @Test
    void anApprovedBackupOpensReadOnlyForFiveMinutesAndIsDroppedWhenClosed() throws Exception {
        String backupId = backup();
        String id = approvedInspection(backupId);
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job where job_type = 'INSPECTION'", Integer.class)).isEqualTo(1);

        Map<String, Object> open = open(id);
        assertThat(open).containsEntry("status", "OPEN");
        String scratch = (String) open.get("scratchDb");
        assertThat(scratch).isEqualTo("inspect_" + id.toLowerCase().replaceAll("[^a-z0-9]", "_"));
        assertThat(databaseExists(scratch)).isTrue();
        Instant expires = Instant.parse((String) open.get("expiresAt"));
        Instant opened = Instant.parse((String) open.get("openedAt"));
        assertThat(Duration.between(opened, expires)).isEqualTo(InspectionService.OPEN_FOR);

        List<?> checks = (List<?>) open.get("checks");
        assertThat(checks).isNotEmpty();
        assertThat(checks.stream().map(c -> (Map<?, ?>) c).filter(c -> Boolean.TRUE.equals(c.get("required"))).allMatch(c -> Boolean.TRUE.equals(c.get("ok"))))
                .as(checks.toString()).isTrue();
        assertThat(checks.stream().map(c -> (Map<?, ?>) c)).anySatisfy(c -> {
            assertThat(c.get("code")).isEqualTo("READ_ONLY");
            assertThat(c.get("ok")).isEqualTo(true);
        });

        assertThat(roleExists("eqms_inspect_reader")).as("the shared reader role is provisioned, not created per copy").isTrue();
        try (java.sql.Connection copy = java.sql.DriverManager.getConnection("jdbc:postgresql://" + db.host() + ":" + db.port() + "/" + scratch, db.user(), db.password());
             java.sql.Statement st = copy.createStatement()) {
            // the privileges are read in the copy itself, where the tables are
            try (java.sql.ResultSet rs = st.executeQuery("select has_table_privilege('eqms_inspect_reader', 'documents', 'SELECT'), "
                    + "has_table_privilege('eqms_inspect_reader', 'documents', 'INSERT'), has_database_privilege('eqms_inspect_reader', current_database(), 'CREATE')")) {
                rs.next();
                assertThat(rs.getBoolean(1)).as("the read-only account can read").isTrue();
                assertThat(rs.getBoolean(2)).as("the read-only account cannot write").isFalse();
                assertThat(rs.getBoolean(3)).as("the read-only account cannot create objects").isFalse();
            }
        }

        Map<String, Object> closed = inspections.close(id, "operator.two", "Finished reading");
        assertThat(closed).containsEntry("status", "CLOSED").containsEntry("closedBy", "operator.two").containsEntry("closeReason", "Finished reading");
        assertThat(databaseExists(scratch)).as("the copy is dropped").isFalse();
        assertThat(ledgerEvents()).contains("INSPECTION_REQUESTED", "INSPECTION_APPROVED", "INSPECTION_OPENED", "INSPECTION_CLOSED");
    }

    @Test
    void theCopyCloseItselfAfterFiveMinutesEvenIfNobodyCloses() {
        String id = approvedInspection(backup());
        Map<String, Object> open = open(id);
        String scratch = (String) open.get("scratchDb");
        // the clock is moved past the time limit in the record, not by waiting five minutes in a test
        db.jdbc.update("update backup_inspection set expires_at = now() - interval '1 second' where inspection_id = ?", id);

        assertThat(inspections.expireDue()).isEqualTo(1);
        Map<String, Object> after = inspections.get(id);
        assertThat(after).containsEntry("status", "CLOSED").containsEntry("closeReason", "EXPIRED").containsEntry("closedBy", "system:inspection-expiry");
        assertThat(databaseExists(scratch)).isFalse();
        assertThat(inspections.expireDue()).as("nothing is left to expire").isZero();
    }

    @Test
    void theRequesterCannotApproveAndAnApprovalNeedsASignature() {
        String id = (String) inspections.request(backup(), "requester.one", "Look at the copy").get("inspectionId");
        assertThatThrownBy(() -> inspections.approve(id, "requester.one", "SIG-1"))
                .isInstanceOf(ExportException.class).hasFieldOrPropertyWithValue("code", "INSPECTION_SAME_PERSON");
        assertThatThrownBy(() -> inspections.approve(id, "approver.one", " "))
                .isInstanceOf(ExportException.class).hasFieldOrPropertyWithValue("code", "INSPECTION_SIGNATURE_REQUIRED");
        assertThat(inspections.get(id)).containsEntry("status", "PENDING_APPROVAL");
        assertThat(ledgerEvents()).contains("INSPECTION_APPROVAL_REFUSED");
    }

    @Test
    void onlyOneInspectionAtATimeAndARejectionFreesTheSlot() {
        String backupId = backup();
        String first = (String) inspections.request(backupId, "requester.one", "First look").get("inspectionId");
        assertThatThrownBy(() -> inspections.request(backupId, "requester.two", "Second look"))
                .isInstanceOf(ExportException.class).hasFieldOrPropertyWithValue("code", "INSPECTION_BUSY");

        assertThatThrownBy(() -> inspections.reject(first, "requester.one", "not mine to decide"))
                .isInstanceOf(ExportException.class).hasFieldOrPropertyWithValue("code", "INSPECTION_SAME_PERSON");
        assertThat(inspections.reject(first, "approver.one", "Not needed now")).containsEntry("status", "REJECTED");
        assertThat(inspections.request(backupId, "requester.two", "Second look")).containsEntry("status", "PENDING_APPROVAL");
    }

    @Test
    void aCopyThatCannotBeRestoredIsDroppedAndRecordedAsFailed() {
        String id = approvedInspection(backup());
        restoreRunner.restoreFails = true;
        Map<String, Object> out = open(id);
        assertThat(out).containsEntry("status", "FAILED").containsEntry("errorCode", "INSPECTION_RESTORE_FAILED");
        assertThat(db.jdbc.queryForObject("select count(*) from pg_database where datname like 'inspect_%'", Integer.class)).isZero();
        assertThat(ledgerEvents()).contains("INSPECTION_FAILED");
    }

    @Test
    void withoutTheReaderRoleNothingIsRestored() {
        String id = approvedInspection(backup());
        // the server is shared with DEV: the role is renamed away and back, never dropped, so its memberships survive
        db.jdbc.execute("alter role eqms_inspect_reader rename to eqms_inspect_reader_absent");
        try {
            Map<String, Object> out = open(id);
            assertThat(out).containsEntry("status", "FAILED").containsEntry("errorCode", "INSPECTION_READER_ROLE_MISSING");
            assertThat(databaseExists("inspect_" + id.toLowerCase().replaceAll("[^a-z0-9]", "_"))).as("no copy is made without a read-only role").isFalse();
        } finally {
            db.jdbc.execute("alter role eqms_inspect_reader_absent rename to eqms_inspect_reader");
        }
    }

    @Test
    void aCopyThatWasNotDroppedIsDroppedByTheNextRetry() throws Exception {
        String id = (String) inspections.request(backup(), "requester.one", "Left behind").get("inspectionId");
        String scratch = "inspect_retry_" + id.toLowerCase().replaceAll("[^a-z0-9]", "_");
        try (java.sql.Connection admin = java.sql.DriverManager.getConnection("jdbc:postgresql://" + db.host() + ":" + db.port() + "/postgres", db.user(), db.password());
             java.sql.Statement st = admin.createStatement()) {
            st.execute("create database \"" + scratch + "\"");
        }
        // the state a failed open leaves when the drop was refused: recorded, not dropped
        db.jdbc.update("update backup_inspection set status = 'FAILED', scratch_db = ?, close_reason = 'OPEN_FAILED_NOT_DROPPED', closed_at = now() where inspection_id = ?", scratch, id);
        opened.add(scratch.substring("inspect_".length()));

        assertThat(inspections.retryUndropped()).isEqualTo(1);
        assertThat(databaseExists(scratch)).as("the retry drops the copy").isFalse();
        assertThat(db.jdbc.queryForObject("select close_reason from backup_inspection where inspection_id = ?", String.class, id)).isEqualTo("OPEN_FAILED");
        assertThat(inspections.retryUndropped()).as("nothing is left to retry").isZero();
    }

    @Test
    void aMissingRestoreWorkerIsWarnedOnceForAnOverdueCopy() {
        String id = approvedInspection(backup());
        db.jdbc.update("update backup_inspection set status = 'OPEN', scratch_db = 'inspect_overdue_probe', opened_at = now() - interval '6 minutes', "
                + "expires_at = now() - interval '3 minutes' where inspection_id = ?", id);

        inspections.alertOverdue();
        inspections.alertOverdue();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'INSPECTION_OVERDUE' and ref = ?", Integer.class, id))
                .as("one warning, not one per poll").isEqualTo(1);
    }

    @Test
    void onlyAnApprovedInspectionOpens() {
        String id = (String) inspections.request(backup(), "requester.one", "Not approved yet").get("inspectionId");
        assertThatThrownBy(() -> open(id)).isInstanceOf(ExportException.class).hasFieldOrPropertyWithValue("code", "INSPECTION_STATE");
        assertThat(inspections.page(null, null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 1L).containsEntry("totalPages", 1);
        assertThat(inspections.page(null, "OPEN", 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 0L);
        assertThat(inspections.page("IS-2026", null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 1L);
        assertThat(inspections.page("no-such-person", null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 0L);
    }
}
