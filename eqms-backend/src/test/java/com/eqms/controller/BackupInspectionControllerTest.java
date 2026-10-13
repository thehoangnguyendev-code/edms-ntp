package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ElectronicSignature;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Backup Inspection (SDS 7.2, phase 1): permissions, the electronic signature on approval and rejection, and the audit trail. */
class BackupInspectionControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BACKUP = "BK-20261009-1900-0001";
    private static final String INSPECTION = "IS-20261010-0002";
    private static final UUID ROW = UUID.fromString("66666666-7777-8888-9999-000000000000");

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupInspectionController controller;

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
    void setUp() {
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        controller = new BackupInspectionController(users, permissions, agent, audit, signatures, new TransactionTemplate(manager));
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("approver.test1");
        allow("backup.module.view", "backup.restore.request", "backup.restore.approve");
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/inspections/" + INSPECTION), isNull()))
                .thenReturn(reply(200, "{\"id\":\"" + ROW + "\",\"inspectionId\":\"" + INSPECTION + "\",\"requestedBy\":\"admin\",\"status\":\"PENDING_APPROVAL\"}"));
    }

    @Test
    void askingDecidingAndReadingEachNeedTheirOwnPermission() {
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.ask(BACKUP, new BackupInspectionController.AskBody("why"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.approve(INSPECTION, new BackupInspectionController.ApproveBody("tok"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.reject(INSPECTION, new BackupInspectionController.ReasonBody("no", "tok"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.close(INSPECTION, null)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void theAskNeedsAReasonAndAKnownBackupId() {
        assertThatThrownBy(() -> controller.ask(BACKUP, new BackupInspectionController.AskBody(" ")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("INSPECTION_REASON_REQUIRED"));
        assertThatThrownBy(() -> controller.ask("BK-1", new BackupInspectionController.AskBody("why")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> controller.get("../secrets"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(agent);
    }

    @Test
    void anAcceptedAskIsAuditedWithTheInspectionIdentifier() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/backups/" + BACKUP + "/inspections"), any()))
                .thenReturn(reply(201, "{\"id\":\"" + ROW + "\",\"inspectionId\":\"" + INSPECTION + "\",\"status\":\"PENDING_APPROVAL\"}"));
        controller.ask(BACKUP, new BackupInspectionController.AskBody("Look at revision 164"));
        verify(audit).logAs(eq(actor), eq("BACKUP_INSPECTION"), eq(INSPECTION), eq(ROW), eq("INSPECTION_REQUESTED"), isNull(), eq("PENDING_APPROVAL"), anyString());
    }

    @Test
    void approvalNeedsAnElectronicSignatureAndIsRecordedWithTheApproval() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/inspections/" + INSPECTION + "/approve"), any()))
                .thenReturn(reply(200, "{\"status\":\"APPROVED\"}"));
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-42");
        when(signatures.record(eq(actor), eq("tok"), eq("BACKUP_INSPECTION_APPROVAL"), eq("BACKUP_INSPECTION"), eq(ROW), eq(INSPECTION), anyString(), isNull(), isNull()))
                .thenReturn(signature);

        assertThat(controller.approve(INSPECTION, new BackupInspectionController.ApproveBody("tok")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(signatures).requireValidToken(actor, "tok");
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/inspections/" + INSPECTION + "/approve"),
                eq(Map.of("by", "approver.test1", "signatureRef", "ESIG-42")));
        verify(audit).logAs(eq(actor), eq("BACKUP_INSPECTION"), eq(INSPECTION), eq(ROW), eq("INSPECTION_APPROVED"), eq("PENDING_APPROVAL"), eq("APPROVED"), anyString());
    }

    @Test
    void aRefusedApprovalIsAuditedAsRefused() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/inspections/" + INSPECTION + "/approve"), any()))
                .thenReturn(reply(409, "{\"code\":\"INSPECTION_SAME_PERSON\",\"message\":\"The person who asked cannot approve\"}"));
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-43");
        when(signatures.record(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);

        assertThat(controller.approve(INSPECTION, new BackupInspectionController.ApproveBody("tok")).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(audit).logAs(eq(actor), eq("BACKUP_INSPECTION"), eq(INSPECTION), eq(ROW), eq("INSPECTION_APPROVAL_REFUSED"), eq("PENDING_APPROVAL"), eq("PENDING_APPROVAL"), anyString());
    }

    @Test
    void aRejectionNeedsAReasonAndItsOwnSignatureMeaning() throws Exception {
        assertThatThrownBy(() -> controller.reject(INSPECTION, new BackupInspectionController.ReasonBody(" ", "tok")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("INSPECTION_REASON_REQUIRED"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/inspections/" + INSPECTION + "/reject"), any())).thenReturn(reply(200, "{\"status\":\"REJECTED\"}"));
        controller.reject(INSPECTION, new BackupInspectionController.ReasonBody("Not needed", "tok"));
        verify(signatures).record(eq(actor), eq("tok"), eq("BACKUP_INSPECTION_REJECTION"), eq("BACKUP_INSPECTION"), eq(ROW), eq(INSPECTION), anyString(), isNull(), isNull());
        verify(audit).logAs(eq(actor), eq("BACKUP_INSPECTION"), eq(INSPECTION), eq(ROW), eq("INSPECTION_REJECTED"), eq("PENDING_APPROVAL"), eq("REJECTED"), anyString());
    }

    @Test
    void closingWithoutAReasonRecordsTheDefault() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/inspections/" + INSPECTION + "/close"), any())).thenReturn(reply(200, "{\"status\":\"CLOSED\"}"));
        controller.close(INSPECTION, null);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/inspections/" + INSPECTION + "/close"),
                eq(Map.of("by", "approver.test1", "reason", "CLOSED_BY_USER")));
        verify(audit).logAs(eq(actor), eq("BACKUP_INSPECTION"), eq(INSPECTION), eq(ROW), eq("INSPECTION_CLOSED"), eq("OPEN"), eq("CLOSED"), anyString());
    }
}
