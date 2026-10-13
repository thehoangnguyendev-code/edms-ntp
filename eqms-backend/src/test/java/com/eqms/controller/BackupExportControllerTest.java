package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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

class BackupExportControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BACKUP = "BK-20261008-1031-0015";
    private static final String EXPORT = "EXP-20261008-0007";

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupExportController controller;

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private BackupAgentClient.Reply reply(int status, String body) {
        return new BackupAgentClient.Reply(status, json(body));
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
        controller = new BackupExportController(users, permissions, agent, audit);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("ops1");
        allow("backup.module.view", "backup.backup.export", "backup.backup.export.approve", "backup.admin.storage.view", "backup.media.manage");
    }

    @Test
    void everyActionNeedsItsOwnPermissionAndNothingReachesTheAgentWithoutIt() {
        allow("backup.module.view");
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupExportController.ExportRequest(id, "why"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.estimate(BACKUP)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.approve(EXPORT)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.reject(EXPORT, new BackupExportController.DecisionRequest("no"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.mediaList(null, null, null, "label", "asc", 1, 10)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.mediaGet(id)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.register(new BackupExportController.MediaRequest("L", "S", "USB", 1L, "d", null))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.handover(id, new BackupExportController.HandoverRequest("h", "l"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.receive(id)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.readTest(id, new BackupExportController.ReadTestRequest("PASSED", "ok"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.recycle(id, new BackupExportController.RecycleRequest(true, "r"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.retire(id, new BackupExportController.RetireRequest("done"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void whoCanApproveIsNotWhoCanRequestAndTheOtherWayRound() {
        allow("backup.module.view", "backup.backup.export");
        assertThatThrownBy(() -> controller.approve(EXPORT)).isInstanceOf(AccessDeniedException.class);
        allow("backup.module.view", "backup.backup.export.approve");
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupExportController.ExportRequest(UUID.randomUUID(), "why"))).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void identifiersAreCheckedBeforeAnythingIsSent() {
        assertThatThrownBy(() -> controller.estimate("BK-1")).isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> controller.approve("../../etc")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.exportGet("EXP-1")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.exportList(null, null, "nope", "requestedAt", "desc", 1, 10)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupExportController.ExportRequest(null, "why"))).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupExportController.ExportRequest(UUID.randomUUID(), " "))).isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("EXPORT_REASON_REQUIRED"));
        verifyNoInteractions(agent);
    }

    @Test
    @SuppressWarnings("unchecked")
    void aRequestIsSentWithTheUsernameAndAuditedOnlyWhenTheAgentAccepts() {
        UUID mediaId = UUID.randomUUID();
        UUID exportUuid = UUID.randomUUID();
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/backups/" + BACKUP + "/exports"), any()))
                .thenReturn(reply(201, "{\"id\":\"" + exportUuid + "\",\"exportId\":\"" + EXPORT + "\",\"mediaLabel\":\"USB-01\"}"));
        ResponseEntity<JsonNode> response = controller.request(BACKUP, new BackupExportController.ExportRequest(mediaId, "Weekly copy"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), anyString(), body.capture());
        assertThat(body.getValue()).containsEntry("by", "ops1").containsEntry("mediaId", mediaId.toString()).containsEntry("reason", "Weekly copy");
        verify(audit).logAs(eq(actor), eq("BACKUP_EXPORT"), eq(EXPORT), eq(exportUuid), eq("BACKUP_EXPORT_REQUESTED"), any(), eq("REQUESTED"), anyString());
    }

    @Test
    void aRefusedRequestKeepsTheAgentsStatusAndReasonAndIsNotAudited() {
        when(agent.exchange(eq(HttpMethod.POST), anyString(), any())).thenReturn(reply(409, "{\"code\":\"EXPORT_MEDIA_BUSY\"}"));
        ResponseEntity<JsonNode> response = controller.request(BACKUP, new BackupExportController.ExportRequest(UUID.randomUUID(), "why"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().path("code").asText()).isEqualTo("EXPORT_MEDIA_BUSY");
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }

    @Test
    void anApprovalAndAnApprovalRefusedForTheSamePersonAreBothAudited() {
        UUID exportUuid = UUID.randomUUID();
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/exports/" + EXPORT), isNull())).thenReturn(reply(200, "{\"id\":\"" + exportUuid + "\",\"status\":\"REQUESTED\"}"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/exports/" + EXPORT + "/approve"), any())).thenReturn(reply(200, "{\"status\":\"APPROVED\"}"));
        assertThat(controller.approve(EXPORT).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(audit).logAs(eq(actor), eq("BACKUP_EXPORT"), eq(EXPORT), eq(exportUuid), eq("BACKUP_EXPORT_APPROVED"), eq("REQUESTED"), eq("APPROVED"), anyString());

        // A refusal body has no id. The audit row must still carry the export's id, or the audit write itself fails.
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/exports/" + EXPORT + "/approve"), any())).thenReturn(reply(409, "{\"code\":\"EXPORT_SAME_PERSON\"}"));
        assertThat(controller.approve(EXPORT).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(audit).logAs(eq(actor), eq("BACKUP_EXPORT"), eq(EXPORT), eq(exportUuid), eq("BACKUP_EXPORT_APPROVAL_REFUSED"), eq("REQUESTED"), eq("REQUESTED"), org.mockito.ArgumentMatchers.contains("EXPORT_SAME_PERSON"));
    }

    @Test
    void rejectingNeedsAReason() {
        assertThatThrownBy(() -> controller.reject(EXPORT, new BackupExportController.DecisionRequest(" "))).isInstanceOf(ResponseStatusException.class);
        when(agent.exchange(eq(HttpMethod.POST), anyString(), any())).thenReturn(reply(200, "{\"id\":\"" + UUID.randomUUID() + "\"}"));
        controller.reject(EXPORT, new BackupExportController.DecisionRequest("Wrong medium"));
        verify(audit).logAs(eq(actor), eq("BACKUP_EXPORT"), eq(EXPORT), any(), eq("BACKUP_EXPORT_REJECTED"), eq("REQUESTED"), eq("REJECTED"), anyString());
    }

    @Test
    void theListsPassBoundedAndEncodedParametersToTheAgent() {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(reply(200, "{\"data\":[]}"));
        controller.exportList("a&b c", "COMPLETED", BACKUP, "media", "asc", 0, 5000);
        controller.mediaList("usb 1", "AVAILABLE", "USB", "kind", "desc", 2, 20);
        ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
        verify(agent, org.mockito.Mockito.times(2)).exchange(eq(HttpMethod.GET), path.capture(), isNull());
        assertThat(path.getAllValues().get(0)).startsWith("/internal/exports?").contains("search=a%26b%20c").contains("status=COMPLETED").contains("backupNumber=" + BACKUP).contains("page=1").contains("limit=100");
        assertThat(path.getAllValues().get(1)).startsWith("/internal/media?").contains("search=usb%201").contains("kind=USB").contains("sortDirection=desc").contains("page=2").contains("limit=20");
    }

    @Test
    void theRegisterIsOpenToWhoSeesStorageOrManagesMediaOrExports() {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(reply(200, "{}"));
        for (String code : new String[] {"backup.admin.storage.view", "backup.media.manage", "backup.backup.export"}) {
            allow(code);
            assertThat(controller.mediaList(null, null, null, "label", "asc", 1, 10).getStatusCode()).isEqualTo(HttpStatus.OK);
        }
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.mediaList(null, null, null, "label", "asc", 1, 10)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void mediaStepsCarryTheUsernameAndAreAuditedOnSuccessOnly() {
        UUID id = UUID.randomUUID();
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/media/" + id + "/handover"), any())).thenReturn(reply(200, "{\"label\":\"USB-01\"}"));
        controller.handover(id, new BackupExportController.HandoverRequest("Ms Keeper", "Vault"));
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/media/" + id + "/handover"), body.capture());
        assertThat(body.getValue()).containsEntry("by", "ops1").containsEntry("holder", "Ms Keeper").containsEntry("location", "Vault");
        verify(audit).logAs(eq(actor), eq("OFFLINE_MEDIA"), eq("USB-01"), eq(id), eq("OFFLINE_MEDIA_HANDED_OVER"), any(), eq("IN_TRANSIT"), anyString());

        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/media/" + id + "/receive"), any())).thenReturn(reply(409, "{\"code\":\"MEDIA_SAME_PERSON\"}"));
        assertThat(controller.receive(id).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), eq("OFFLINE_MEDIA_RECEIVED"), any(), any(), anyString());
    }

    @Test
    @SuppressWarnings("unchecked")
    void aRecycleWithoutTheWipeConfirmationIsSentAsFalse() {
        UUID id = UUID.randomUUID();
        when(agent.exchange(eq(HttpMethod.POST), anyString(), any())).thenReturn(reply(400, "{\"code\":\"MEDIA_WIPE_UNCONFIRMED\"}"));
        controller.recycle(id, new BackupExportController.RecycleRequest(null, "reuse"));
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), anyString(), body.capture());
        assertThat(body.getValue()).containsEntry("wipeConfirmed", false);
    }
}
