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
import org.mockito.ArgumentCaptor;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Restore into production: who may do what, that the electronic signature comes first, and that a refused request leaves no signature. */
class BackupProductionRestoreControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BACKUP = "BK-20261008-1900-0017";
    private static final String RUN = "RS-0123456789ab";

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    UserAccount actor = mock(UserAccount.class);
    SimpleTransactionStatus txStatus = new SimpleTransactionStatus();
    BackupProductionRestoreController controller;

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
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
        when(manager.getTransaction(any())).thenReturn(txStatus);
        controller = new BackupProductionRestoreController(users, permissions, agent, audit, signatures, new TransactionTemplate(manager));
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("qa.one");
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("SIG-42");
        when(signatures.record(any(), anyString(), anyString(), anyString(), any(UUID.class), anyString(), anyString(), any(), any())).thenReturn(signature);
        allow("backup.module.view", "backup.restore.execute", "backup.restore.finalize");
    }

    @Test
    void restoreNeedsExecuteAndFinalizeNeedsItsOwnPermission() {
        allow("backup.module.view", "backup.restore.finalize");
        assertThatThrownBy(() -> controller.restore(BACKUP, new BackupProductionRestoreController.RestoreBody("tok", null))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.rollBack(RUN, new BackupProductionRestoreController.SignedBody("tok"))).isInstanceOf(AccessDeniedException.class);
        allow("backup.module.view", "backup.restore.execute");
        assertThatThrownBy(() -> controller.finalizeRestore(RUN, new BackupProductionRestoreController.SignedBody("tok"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
        verifyNoInteractions(signatures);
    }

    @Test
    void withoutAValidSignatureNothingIsSentToTheAgent() {
        doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(any(), any());
        assertThatThrownBy(() -> controller.restore(BACKUP, new BackupProductionRestoreController.RestoreBody(null, null))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.finalizeRestore(RUN, new BackupProductionRestoreController.SignedBody("bad"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
        verify(signatures, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void signedRestoreSendsPersonAndSignatureReferenceToTheAgentAndIsAudited() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/production"), any())).thenReturn(new BackupAgentClient.Reply(202, json("{\"jobId\":\"j1\"}")));
        var response = controller.restore(BACKUP, new BackupProductionRestoreController.RestoreBody("tok", null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/restores/production"), payload.capture());
        Map<String, Object> sent = payload.getValue();
        assertThat(sent).containsEntry("backupNumber", BACKUP).containsEntry("by", "qa.one").containsEntry("signatureRef", "SIG-42");
        verify(signatures).record(eq(actor), eq("tok"), eq("BACKUP_RESTORE_EXECUTION"), eq("BACKUP_RESTORE"), any(UUID.class), eq(BACKUP), anyString(), isNull(), isNull());
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(BACKUP), any(UUID.class), eq("PRODUCTION_RESTORE_REQUESTED"), any(), any(), anyString());
        assertThat(txStatus.isRollbackOnly()).isFalse();
    }

    @Test
    void aRefusedRequestUndoesTheSignatureAndIsAuditedAsRefused() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/production/" + RUN + "/finalize"), any()))
                .thenReturn(new BackupAgentClient.Reply(409, json("{\"code\":\"RESTORE_ALREADY_CLOSED\"}")));
        var response = controller.finalizeRestore(RUN, new BackupProductionRestoreController.SignedBody("tok"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(txStatus.isRollbackOnly()).isTrue();
        verify(signatures).record(eq(actor), eq("tok"), eq("BACKUP_RESTORE_FINALIZATION"), eq("BACKUP_RESTORE"), any(UUID.class), eq(RUN), anyString(), isNull(), isNull());
        verify(audit).logAs(eq(actor), eq("BACKUP_RESTORE"), eq(RUN), any(UUID.class), eq("PRODUCTION_RESTORE_FINALIZED_REFUSED"), any(), any(), anyString());
    }

    @Test
    void rollbackUsesItsOwnSignatureMeaning() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/production/" + RUN + "/rollback"), any())).thenReturn(new BackupAgentClient.Reply(202, json("{\"jobId\":\"j2\"}")));
        controller.rollBack(RUN, new BackupProductionRestoreController.SignedBody("tok"));
        verify(signatures).record(eq(actor), eq("tok"), eq("BACKUP_RESTORE_ROLLBACK"), eq("BACKUP_RESTORE"), any(UUID.class), eq(RUN), anyString(), isNull(), isNull());
    }

    @Test
    @SuppressWarnings("unchecked")
    void thePartsToRestoreAreCheckedAndSentToTheAgent() {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/restores/production"), any())).thenReturn(new BackupAgentClient.Reply(202, json("{\"jobId\":\"j9\"}")));
        controller.restore(BACKUP, new BackupProductionRestoreController.RestoreBody("tok", java.util.List.of("OBJECT_STORE", "OBJECT_STORE")));
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/restores/production"), payload.capture());
        assertThat(payload.getValue().get("components")).isEqualTo(java.util.List.of("OBJECT_STORE"));
        assertThatThrownBy(() -> controller.restore(BACKUP, new BackupProductionRestoreController.RestoreBody("tok", java.util.List.of())))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("RESTORE_PARTS_REQUIRED"));
        assertThatThrownBy(() -> controller.restore(BACKUP, new BackupProductionRestoreController.RestoreBody("tok", java.util.List.of("DROP"))))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("RESTORE_PART_UNKNOWN"));
    }

    @Test
    void identifiersAreValidatedBeforeAnythingElseHappens() {
        assertThatThrownBy(() -> controller.restore("BK-1", new BackupProductionRestoreController.RestoreBody("tok", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> controller.finalizeRestore("../x", new BackupProductionRestoreController.SignedBody("tok"))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.job("not-a-job")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void theListIsPagedFilteredAndSortedByTheAgentAndNeedsView() {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(new BackupAgentClient.Reply(200, json("{\"data\":[],\"pagination\":{}}")));
        controller.list("bk 1", "FINALIZED", null, null, null, null, null, "backupNumber", "asc", 0, 5000);
        ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
        verify(agent).exchange(eq(HttpMethod.GET), path.capture(), isNull());
        assertThat(path.getValue()).startsWith("/internal/restores/production?").contains("search=bk%201").contains("status=FINALIZED")
                .contains("sortBy=backupNumber").contains("sortDirection=asc").contains("page=1").contains("limit=100");
        allow();
        assertThatThrownBy(() -> controller.list(null, null, null, null, null, null, null, "restoredAt", "desc", 1, 10)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void capabilitiesFollowThePermissions() {
        allow("backup.module.view", "backup.restore.execute");
        assertThat(controller.capabilities()).containsEntry("restore", true).containsEntry("rollback", true).containsEntry("finalize", false);
        allow("backup.module.view", "backup.restore.finalize");
        assertThat(controller.capabilities()).containsEntry("restore", false).containsEntry("finalize", true);
    }
}
