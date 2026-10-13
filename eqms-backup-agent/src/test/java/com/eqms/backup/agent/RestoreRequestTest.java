package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.DatabaseBackupService;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import com.eqms.backup.agent.maintenance.MaintenanceService.MaintenanceException;
import com.eqms.backup.agent.manifest.SigningKeys;
import com.eqms.backup.agent.objects.ObjectBackupService;
import com.eqms.backup.agent.policy.PolicyView;
import com.eqms.backup.agent.restore.RestoreRehearsalService;
import com.eqms.backup.agent.restore.RestoreRequestService;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Restore requests, steps R0-R3 (SDS 11.3): the impact report, the approval by another person, and rejection. */
class RestoreRequestTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    FakeCommandRunner runner;
    FakeObjectSource docs;
    LedgerService ledger;
    BackupRepository repository;
    DatabaseBackupService backups;
    RestoreRequestService requests;
    com.eqms.backup.agent.restore.RestoreExecutionService execution;
    com.eqms.backup.agent.maintenance.MaintenanceService maintenance;
    RestoreRehearsalService rehearsals;

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
        properties.getMaintenance().setLockFile(tmp.resolve("maintenance").resolve("maintenance.lock"));
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
        ManifestService manifests = new ManifestService(new SigningKeys(properties));
        GpgKeyring keyring = new GpgKeyring(properties, runner);
        VerificationService verification = new VerificationService(db.jdbc, repository, manifests, ledger, keyring, runner);
        ObjectBackupService objects = new ObjectBackupService(properties, docs, repository, runner, keyring);
        objects.retryDelayMillis(1);
        PolicyView policy = new PolicyView(1, java.util.Set.of("DATABASE", "OBJECT_STORE"), java.util.Set.of("T1"));
        backups = new DatabaseBackupService(properties, repository, ledger, manifests, runner, keyring, verification,
                new ReplicationService(new TargetRegistry(List.of()), repository, ledger), objects, () -> Optional.of(policy));
        requests = new RestoreRequestService(db.jdbc, db.tx, ledger, repository, properties, new com.eqms.backup.agent.restore.RestoreRules(db.jdbc, ledger));
        maintenance = new com.eqms.backup.agent.maintenance.MaintenanceService(db.jdbc, db.tx, ledger, properties);
        rehearsals = mock(RestoreRehearsalService.class);
        when(rehearsals.request(anyString(), anyString(), anyString())).thenReturn(Map.of("rehearsalId", "RH-TEST-1"));
        when(rehearsals.get("RH-TEST-1")).thenReturn(Map.of("rehearsalId", "RH-TEST-1", "status", "QUEUED", "checks", List.of()));
        execution = new com.eqms.backup.agent.restore.RestoreExecutionService(db.jdbc, db.tx, ledger, maintenance, rehearsals);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private String backup() {
        docs.add("docs", "a.pdf", "v1", "first document", true);
        DatabaseBackupService.Outcome o = backups.run(new DatabaseBackupService.Request("FULL", "MANUAL", "operator.one", "test run", null));
        assertThat(o.ok()).as(String.valueOf(o.errorDetail())).isTrue();
        assertThat(o.verification().verified()).isTrue();
        return o.backupNumber();
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    private void refused(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo(code));
    }

    private void maintenanceRefused(Runnable action, String code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(MaintenanceException.class, e -> assertThat(e.code).isEqualTo(code));
    }

    @Test
    void aValidationRestoreRequestCarriesAMeasuredImpactReportAndWaitsForApproval() {
        String backupNumber = backup();
        Map<String, Object> asked = requests.request(backupNumber, "R-FULL", "VALIDATION", "Annual restore test", "CC-2026-0150", "requester.one");

        assertThat(asked).containsEntry("status", "PENDING_APPROVAL").containsEntry("type", "R-FULL").containsEntry("target", "VALIDATION")
                .containsEntry("changeControlRef", "CC-2026-0150").containsEntry("requestedBy", "requester.one");
        @SuppressWarnings("unchecked")
        Map<String, Object> impact = (Map<String, Object>) asked.get("impact");
        assertThat(impact).containsKeys("components", "rowsInBackup", "targets", "liveRowsAfterBackup", "dbSnapshotAt");
        @SuppressWarnings("unchecked")
        Map<String, Object> live = (Map<String, Object>) impact.get("liveRowsAfterBackup");
        assertThat(live).as("the live database was read").containsEntry("measured", true);
        assertThat((String) asked.get("impactSha256")).hasSize(64);
        assertThat(ledgerEvents()).contains("RESTORE_REQUESTED");
    }

    @Test
    void theRequestIsRefusedWithAStableCodeWhenTheInputOrTheBackupIsWrong() {
        String backupNumber = backup();
        refused(() -> requests.request(backupNumber, "R-EVERYTHING", "VALIDATION", "why", null, "requester.one"), "RESTORE_TYPE");
        refused(() -> requests.request(backupNumber, "R-FULL", "LAPTOP", "why", null, "requester.one"), "RESTORE_TARGET");
        refused(() -> requests.request(backupNumber, "R-FULL", "VALIDATION", " ", null, "requester.one"), "RESTORE_REASON_REQUIRED");
        refused(() -> requests.request("BK-20200101-0000-0001", "R-FULL", "VALIDATION", "why", null, "requester.one"), "BACKUP_NOT_FOUND");
        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) "
                + "select id, 'V1', 'FAILED', '{}'::jsonb, now() + interval '1 second', 'x' from backup_run where backup_number = ?", backupNumber);
        refused(() -> requests.request(backupNumber, "R-FULL", "VALIDATION", "why", null, "requester.one"), "RESTORE_BACKUP_NOT_VERIFIED");
    }

    @Test
    void aProductionRestoreNeedsARecentPassingTestRestoreOfThatBackup() {
        String backupNumber = backup();
        refused(() -> requests.request(backupNumber, "R-FULL", "PRODUCTION", "why", null, "requester.one"), "RESTORE_REHEARSAL_REQUIRED");
        assertThat(requests.readiness(backupNumber)).containsEntry("testRestore", null);

        db.jdbc.update("insert into restore_rehearsal(rehearsal_id, run_id, status, requested_by, reason, finished_at) "
                + "select 'RH-TEST-0001', id, 'PASSED', 'tester', 'test', now() from backup_run where backup_number = ?", backupNumber);
        Map<String, Object> asked = requests.request(backupNumber, "R-FULL", "PRODUCTION", "Restore after incident", null, "requester.one");
        assertThat(asked).containsEntry("target", "PRODUCTION").containsKey("rehearsalId");
        assertThat(requests.readiness(backupNumber).get("testRestore")).isNotNull();
        db.jdbc.update("update restore_rehearsal set finished_at = now() - interval '31 days' where rehearsal_id = 'RH-TEST-0001'");
        assertThat(requests.readiness(backupNumber)).containsEntry("testRestore", null);
        db.jdbc.update("update restore_rehearsal set finished_at = now() where rehearsal_id = 'RH-TEST-0001'");
        assertThat(asked.get("rehearsalId")).isNotNull();
    }

    @Test
    void onlyOneRequestCanWaitForAGivenBackup() {
        String backupNumber = backup();
        requests.request(backupNumber, "R-FULL", "VALIDATION", "first", null, "requester.one");
        refused(() -> requests.request(backupNumber, "R-DB", "VALIDATION", "second", null, "requester.two"), "RESTORE_ALREADY_OPEN");
    }

    @Test
    void theRequesterCannotApproveAndTheApprovalNeedsASignature() {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "why", null, "requester.one").get("restoreNumber");
        refused(() -> requests.approve(id, "Requester.One", "SIG-1"), "RESTORE_SAME_PERSON");
        refused(() -> requests.approve(id, "approver.two", " "), "RESTORE_SIGNATURE_REQUIRED");
        assertThat(requests.get(id)).containsEntry("status", "PENDING_APPROVAL");
        assertThat(ledgerEvents()).contains("RESTORE_APPROVAL_REFUSED");
    }

    @Test
    void anotherPersonApprovesAndTheImpactIsMeasuredAgainAtThatMoment() {
        String backupNumber = backup();
        Map<String, Object> asked = requests.request(backupNumber, "R-FULL", "VALIDATION", "why", null, "requester.one");
        String id = (String) asked.get("restoreNumber");

        Map<String, Object> approved = requests.approve(id, "approver.two", "SIG-123");
        assertThat(approved).containsEntry("status", "APPROVED").containsEntry("approvedBy", "approver.two").containsEntry("approvalSignatureRef", "SIG-123");
        assertThat(approved).containsKey("decidedAt");
        assertThat(approved.get("events").toString()).contains("REQUESTED").contains("APPROVED");
        assertThat(ledgerEvents()).contains("RESTORE_REQUESTED", "RESTORE_APPROVED");
        assertThat(ledger.verify().ok()).isTrue();

        refused(() -> requests.approve(id, "approver.three", "SIG-9"), "RESTORE_STATE");
        refused(() -> requests.reject(id, "approver.three", "too late"), "RESTORE_STATE");
    }

    @Test
    void aRejectionNeedsAReasonAndTheRequesterCannotRejectTheirOwn() {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "why", null, "requester.one").get("restoreNumber");
        refused(() -> requests.reject(id, "requester.one", "mine"), "RESTORE_SAME_PERSON");
        refused(() -> requests.reject(id, "approver.two", " "), "RESTORE_REASON_REQUIRED");
        Map<String, Object> rejected = requests.reject(id, "approver.two", "The change control is not approved yet");
        assertThat(rejected).containsEntry("status", "REJECTED").containsEntry("decisionReason", "The change control is not approved yet");
        assertThat(ledgerEvents()).contains("RESTORE_REJECTED");
    }

    @Test
    void theListFiltersAndPagesOnTheServer() {
        String backupNumber = backup();
        requests.request(backupNumber, "R-FULL", "VALIDATION", "why", null, "requester.one");
        assertThat(requests.page(null, "PENDING_APPROVAL", null, "requestedAt", false, 1, 10).total()).isEqualTo(1);
        assertThat(requests.page(null, "APPROVED", null, "requestedAt", false, 1, 10).total()).isZero();
        assertThat(requests.page("requester", null, "VALIDATION", "requestedAt", false, 1, 10).total()).isEqualTo(1);
        assertThat(requests.page(null, null, "PRODUCTION", "requestedAt", false, 1, 10).total()).isZero();
    }

    @Test
    void anApprovedRequestIsScheduledForAWindowOnlyByAPersonOtherThanTheApprover() {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "Scheduling test", null, "requester.one").get("restoreNumber");
        refused(() -> execution.schedule(id, "executor.one", java.time.Instant.now().plusSeconds(3600)), "RESTORE_STATE");

        requests.approve(id, "approver.two", "SIG-SCHED-1");
        Map<String, Object> before = execution.preflight(id);
        assertThat(before).as(String.valueOf(before.get("checks"))).containsEntry("readyToSchedule", true).containsEntry("schedule", null);
        assertThat((List<?>) before.get("notCheckedYet")).isNotEmpty();

        refused(() -> execution.schedule(id, "approver.two", java.time.Instant.now().plusSeconds(3600)), "RESTORE_SAME_PERSON");
        refused(() -> execution.schedule(id, "executor.one", java.time.Instant.now().minusSeconds(60)), "RESTORE_WINDOW_IN_PAST");

        Map<String, Object> scheduled = execution.schedule(id, "executor.one", java.time.Instant.now().plusSeconds(3600));
        assertThat(scheduled).containsEntry("readyToSchedule", true);
        assertThat((Map<String, Object>) scheduled.get("schedule")).containsEntry("scheduledBy", "executor.one");
        assertThat(ledgerEvents()).contains("RESTORE_SCHEDULED");
        refused(() -> execution.schedule(id, "executor.one", java.time.Instant.now().plusSeconds(7200)), "RESTORE_IN_PROGRESS");
    }

    @Test
    void theChecksOfAPendingRequestSayNotReadyAndTheRunIsNeverStarted() {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "Not yet approved", null, "requester.one").get("restoreNumber");
        Map<String, Object> checks = execution.preflight(id);
        assertThat(checks).containsEntry("readyToSchedule", false).containsEntry("status", "PENDING_APPROVAL");
        assertThat(checks.get("checks").toString()).contains("REQUEST_APPROVED");
    }

    @Test
    void theRestoreWindowLocksTheSystemOnlyWhenTheWindowHasComeAndTheNoticeIsForThisRequest() throws Exception {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "Window test", null, "requester.one").get("restoreNumber");
        requests.approve(id, "approver.two", "SIG-WIN-1");
        refused(() -> execution.enterWindow(id, "executor.one", true), "RESTORE_NOT_SCHEDULED");

        execution.schedule(id, "executor.one", java.time.Instant.now().plusSeconds(3600));
        refused(() -> execution.enterWindow(id, "executor.one", true), "RESTORE_WINDOW_NOT_REACHED");

        db.jdbc.update("update restore_execution set window_start = now() - interval '1 minute' where status = 'SCHEDULED'");
        refused(() -> execution.enterWindow(id, "executor.one", true), "RESTORE_NOT_DRAINED");

        maintenance.notice(5, "RQ-OTHER", "executor.one");
        db.jdbc.update("update maintenance_state set ends_at = now() - interval '1 second' where id = 1");
        maintenance.tick();
        refused(() -> execution.enterWindow(id, "executor.one", true), "RESTORE_NOT_DRAINED");
        maintenance.cancel("admin.one");

        maintenance.notice(5, id, "executor.one");
        db.jdbc.update("update maintenance_state set ends_at = now() - interval '1 second' where id = 1");
        maintenance.tick();
        assertThat(maintenance.status().state()).isEqualTo(MaintenanceService.State.DRAINED);
        maintenanceRefused(() -> execution.enterWindow(id, "executor.one", false), "MAINTENANCE_CONFIRMATION_REQUIRED");
        assertThat(maintenance.status().state()).as("a refused window changes nothing").isEqualTo(MaintenanceService.State.DRAINED);

        Map<String, Object> out = execution.enterWindow(id, "executor.one", true);
        assertThat(out).containsEntry("systemState", "LOCKED_RESTORING");
        assertThat(maintenance.status().state()).isEqualTo(MaintenanceService.State.LOCKED_RESTORING);
        assertThat(Files.readString(tmp.resolve("maintenance").resolve("maintenance.lock"))).contains("\"state\":\"LOCKED_RESTORING\"").contains(id);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_execution_event where event = 'WINDOW_LOCKED'", Integer.class)).isEqualTo(1);
        assertThat(ledgerEvents()).contains("MAINTENANCE_LOCKED");
        refused(() -> execution.enterWindow(id, "executor.one", true), "RESTORE_NOT_DRAINED");
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void theTestRestoreStartsOnceInsideTheLockedWindowAndTouchesOnlyTheScratchCopy() throws Exception {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "Test restore in window", null, "requester.one").get("restoreNumber");
        requests.approve(id, "approver.two", "SIG-TEST-1");
        execution.schedule(id, "executor.one", java.time.Instant.now().plusSeconds(3600));
        refused(() -> execution.startTestRestore(id, "executor.one"), "RESTORE_NOT_LOCKED");

        db.jdbc.update("update restore_execution set window_start = now() - interval '1 minute' where status = 'SCHEDULED'");
        maintenance.notice(5, id, "executor.one");
        db.jdbc.update("update maintenance_state set ends_at = now() - interval '1 second' where id = 1");
        maintenance.tick();
        execution.enterWindow(id, "executor.one", true);

        Map<String, Object> out = execution.startTestRestore(id, "executor.one");
        assertThat(out).containsEntry("rehearsalId", "RH-TEST-1").containsEntry("status", "QUEUED");
        verify(rehearsals).request(eq(backupNumber), eq("executor.one"), anyString());
        assertThat(ledgerEvents()).contains("RESTORE_TEST_QUEUED");
        refused(() -> execution.startTestRestore(id, "executor.one"), "RESTORE_TEST_ALREADY_REQUESTED");
        verify(rehearsals, times(1)).request(anyString(), anyString(), anyString());
        Map<String, Object> checks = execution.preflight(id);
        assertThat(checks).containsEntry("systemState", "LOCKED_RESTORING").containsEntry("systemRequestId", id);
        assertThat((Map<String, Object>) checks.get("testRestore")).containsEntry("rehearsalId", "RH-TEST-1").containsEntry("status", "QUEUED");
    }

    @Test
    void theEvidencePackIsSignedCarriesTheDecisionsAndChangedTextDoesNotVerify() throws Exception {
        String backupNumber = backup();
        String id = (String) requests.request(backupNumber, "R-FULL", "VALIDATION", "Evidence test", null, "requester.one").get("restoreNumber");
        requests.approve(id, "approver.two", "SIG-EV-1");
        execution.schedule(id, "executor.one", java.time.Instant.now().plusSeconds(3600));
        var manifests = new com.eqms.backup.agent.manifest.ManifestService(new com.eqms.backup.agent.manifest.SigningKeys(properties));
        var evidence = new com.eqms.backup.agent.restore.RestoreEvidence(requests, execution, rehearsals, manifests, ledger);
        Map<String, Object> out = evidence.pack(id);
        String text = (String) out.get("pack");
        String signature = (String) out.get("signature");
        assertThat(manifests.signatureValid(text, signature)).isTrue();
        assertThat(text).contains("\"restoreNumber\":\"" + id + "\"").contains("\"approvedBy\"").contains("RESTORE_SCHEDULED").contains("\"ok\":true");
        assertThat(manifests.signatureValid(text.replace("approver.two", "someone.else"), signature)).as("changed evidence does not verify").isFalse();
    }
}
