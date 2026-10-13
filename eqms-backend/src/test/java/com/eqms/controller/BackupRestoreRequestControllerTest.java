package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Restore requests (SDS 11.3, R0-R3): permissions, the electronic signature on approval, and the audit trail of each decision. */
class BackupRestoreRequestControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BACKUP = "BK-20261008-1900-0017";
    private static final String REQUEST = "RS-20261009-0001";
    private static final UUID REQUEST_UUID = UUID.fromString("11111111-2222-3333-4444-555555555555");

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    com.eqms.service.RestoreApprovalNotifier notifier = mock(com.eqms.service.RestoreApprovalNotifier.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupRestoreRequestController controller;

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private BackupAgentClient.Reply reply(int code, String body) {
        return new BackupAgentClient.Reply(code, json(body));
    }

    private void allow(String... codes) {
        when(permissions.hasAnyPermission(any(UserAccount.class), any(String[].class))).thenAnswer(inv -> {
            Object[] args = inv.getArguments();
            for (int i = 1; i < args.length; i++) {
                if (args[i] instanceof String s && Arrays.asList(codes).contains(s)) return true;
                if (args[i] instanceof String[] arr && Arrays.stream(arr).anyMatch(Arrays.asList(codes)::contains)) return true;
            }
            return false;
        });
    }

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        controller = new BackupRestoreRequestController(users, permissions, agent, audit, signatures, new TransactionTemplate(manager), notifier);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("approver.two");
        allow("backup.module.view", "backup.restore.request", "backup.restore.approve");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/restores/" + REQUEST), isNull()))
                .thenReturn(reply(200, "{\"id\":\"" + REQUEST_UUID + "\",\"requestId\":\"" + REQUEST + "\",\"requestedBy\":\"requester.one\",\"status\":\"PENDING_APPROVAL\"}"));
    }

    @Test
    void askingApprovingAndReadingEachNeedTheirOwnPermission() {
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupRestoreRequestController.CreateRestoreBody("R-FULL", "VALIDATION", "why", null)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.approve(REQUEST, new BackupRestoreRequestController.ApproveBody("tok"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.reject(REQUEST, new BackupRestoreRequestController.ReasonBody("no", "tok"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void theRequestNeedsAReasonAndAKnownBackupId() {
        allow("backup.module.view", "backup.restore.request");
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupRestoreRequestController.CreateRestoreBody("R-FULL", "VALIDATION", " ", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("RESTORE_REASON_REQUIRED"));
        assertThatThrownBy(() -> controller.request("BK-1", new BackupRestoreRequestController.CreateRestoreBody("R-FULL", "VALIDATION", "why", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(agent);
    }

    @Test
    void aRequestIsAuditedWithItsOwnIdentifierOnlyWhenAccepted() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/backups/" + BACKUP + "/restores"), any()))
                .thenReturn(reply(201, "{\"id\":\"" + REQUEST_UUID + "\",\"requestId\":\"" + REQUEST + "\",\"status\":\"PENDING_APPROVAL\"}"));
        controller.request(BACKUP, new BackupRestoreRequestController.CreateRestoreBody("R-FULL", "VALIDATION", "Annual test", "CC-1"));
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_REQUESTED"), isNull(), eq("PENDING_APPROVAL"), anyString());
    }

    @Test
    void approvalNeedsAnElectronicSignatureAndIsRecordedWithTheApproval() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/approve"), any()))
                .thenReturn(reply(200, "{\"status\":\"APPROVED\"}"));
        var signature = mock(com.eqms.entity.ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-9");
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_RESTORE_APPROVAL"), eq("BACKUP_RESTORE"), eq(REQUEST_UUID), eq(REQUEST), anyString(), isNull(), isNull()))
                .thenReturn(signature);

        assertThat(controller.approve(REQUEST, new BackupRestoreRequestController.ApproveBody("tok")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(signatures).requireValidToken(actor, "tok");
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_APPROVED"), eq("PENDING_APPROVAL"), eq("APPROVED"), anyString());
        verify(notifier).approved(eq(REQUEST), anyString(), eq("approver.two"));
    }

    @Test
    void aRefusedApprovalIsNotSignedAndItsRefusalIsAudited() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/approve"), any()))
                .thenReturn(reply(409, "{\"code\":\"RESTORE_SAME_PERSON\"}"));
        var signature = mock(com.eqms.entity.ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-10");
        when(signatures.record(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);

        assertThat(controller.approve(REQUEST, new BackupRestoreRequestController.ApproveBody("tok")).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_APPROVAL_REFUSED"), eq("PENDING_APPROVAL"), eq("PENDING_APPROVAL"), anyString());
        verify(audit, never()).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_APPROVED"), any(), any(), anyString());
    }

    @Test
    void anApprovalWithoutASignatureIsRefusedBeforeTheAgentIsAsked() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(actor, null);
        assertThatThrownBy(() -> controller.approve(REQUEST, new BackupRestoreRequestController.ApproveBody(null))).isInstanceOf(AccessDeniedException.class);
        verify(agent, never()).exchange(eq(HttpMethod.POST), anyString(), any());
    }

    @Test
    void aRejectionNeedsAReasonAndIsAudited() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/reject"), any())).thenReturn(reply(200, "{\"status\":\"REJECTED\"}"));
        assertThatThrownBy(() -> controller.reject(REQUEST, new BackupRestoreRequestController.ReasonBody(" ", "tok"))).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getReason()).isEqualTo("RESTORE_REASON_REQUIRED"));
        controller.reject(REQUEST, new BackupRestoreRequestController.ReasonBody("Change control not approved", "tok"));
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_REJECTED"), eq("PENDING_APPROVAL"), eq("REJECTED"), anyString());
    }

    @Test
    void theListPassesBoundedParametersOn() {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(reply(200, "{\"data\":[]}"));
        controller.list("a&b", "PENDING_APPROVAL", "VALIDATION", "status", "asc", 0, 5000);
        verify(agent).exchange(eq(HttpMethod.GET), eq("/internal/restores?search=a%26b&status=PENDING_APPROVAL&target=VALIDATION&sortBy=status&sortDirection=asc&page=1&limit=100"), isNull());
    }

    @Test
    void schedulingNeedsTheExecutePermissionAndIsAuditedWhenAccepted() {
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.schedule(REQUEST, new BackupRestoreRequestController.ScheduleBody("2026-10-10T02:00:00Z")))
                .isInstanceOf(AccessDeniedException.class);
        verify(agent, never()).exchange(eq(HttpMethod.POST), any(), any());

        allow("backup.module.view", "backup.restore.execute");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/schedule"), any()))
                .thenReturn(reply(200, "{\"status\":\"APPROVED\"}"));
        assertThat(controller.schedule(REQUEST, new BackupRestoreRequestController.ScheduleBody("2026-10-10T02:00:00Z")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_SCHEDULED"), eq("APPROVED"), eq("APPROVED"), anyString());
    }

    @Test
    void enteringTheWindowNeedsTheExecutePermissionAndIsAuditedWhenAccepted() {
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.enterWindow(REQUEST, new BackupRestoreRequestController.EnterWindowBody(true)))
                .isInstanceOf(AccessDeniedException.class);
        verify(agent, never()).exchange(eq(HttpMethod.POST), any(), any());

        allow("backup.module.view", "backup.restore.execute");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/enter-window"), any()))
                .thenReturn(reply(200, "{\"systemState\":\"LOCKED_RESTORING\"}"));
        assertThat(controller.enterWindow(REQUEST, new BackupRestoreRequestController.EnterWindowBody(true)).getStatusCode()).isEqualTo(HttpStatus.OK);
        String who = actor.getUsername();
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/enter-window"),
                eq(Map.of("by", who, "noUserConfirmed", true)));
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_WINDOW_LOCKED"), eq("APPROVED"), eq("LOCKED_RESTORING"), anyString());
    }

    @Test
    void theTestRestoreNeedsTheExecutePermissionAndIsAuditedWhenAccepted() {
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.testRestore(REQUEST)).isInstanceOf(AccessDeniedException.class);
        verify(agent, never()).exchange(eq(HttpMethod.POST), any(), any());

        allow("backup.module.view", "backup.restore.execute");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/test-restore"), any()))
                .thenReturn(reply(200, "{\"status\":\"QUEUED\"}"));
        assertThat(controller.testRestore(REQUEST).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(REQUEST), eq(REQUEST_UUID), eq("RESTORE_TEST_STARTED"), eq("LOCKED_RESTORING"), eq("LOCKED_RESTORING"), anyString());
    }

    @Test
    void aRefusedWindowIsNotAudited() {
        allow("backup.module.view", "backup.restore.execute");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/" + REQUEST + "/enter-window"), any()))
                .thenReturn(reply(409, "{\"code\":\"RESTORE_WINDOW_NOT_REACHED\"}"));
        assertThat(controller.enterWindow(REQUEST, new BackupRestoreRequestController.EnterWindowBody(true)).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), eq("RESTORE_WINDOW_LOCKED"), anyString(), anyString(), anyString());
    }

    @Test
    void theExecutionChecksAreReadWithTheViewPermissionOnly() {
        allow("backup.module.view");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/restores/" + REQUEST + "/execution"), any()))
                .thenReturn(reply(200, "{\"readyToSchedule\":true}"));
        assertThat(controller.execution(REQUEST).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(agent).exchange(eq(HttpMethod.GET), eq("/internal/restores/" + REQUEST + "/execution"), any());
    }
}
