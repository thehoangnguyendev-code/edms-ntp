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

class BackupRehearsalControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BACKUP = "BK-20261008-1525-0016";

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupRehearsalController controller;

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
        controller = new BackupRehearsalController(users, permissions, agent, audit);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("tester.one");
        allow("backup.module.view", "backup.restore.test");
    }

    @Test
    void readingNeedsTheModuleViewAndAskingNeedsItsOwnPermission() {
        allow();
        assertThatThrownBy(() -> controller.list(null, null, null, "requestedAt", "desc", 1, 10)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.get("RH-20261009-0001")).isInstanceOf(AccessDeniedException.class);
        allow("backup.module.view");
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupRehearsalController.RehearsalRequest("why"))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void aReasonIsRequiredAndABadIdentifierNeverReachesTheAgent() {
        assertThatThrownBy(() -> controller.request(BACKUP, new BackupRehearsalController.RehearsalRequest("  ")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REHEARSAL_REASON_REQUIRED"));
        assertThatThrownBy(() -> controller.request("BK-1", new BackupRehearsalController.RehearsalRequest("why")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> controller.get("RH-../../x")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(agent);
    }

    @Test
    @SuppressWarnings("unchecked")
    void aRequestIsSentWithTheUsernameAndAuditedOnlyWhenAccepted() {
        UUID id = UUID.randomUUID();
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/backups/" + BACKUP + "/rehearsals"), any()))
                .thenReturn(new BackupAgentClient.Reply(202, json("{\"id\":\"" + id + "\",\"rehearsalId\":\"RH-20261009-0001\",\"status\":\"QUEUED\"}")));
        assertThat(controller.request(BACKUP, new BackupRehearsalController.RehearsalRequest("Annual test")).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        ArgumentCaptor<Map> body = ArgumentCaptor.forClass(Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), anyString(), body.capture());
        assertThat(body.getValue()).containsEntry("by", "tester.one").containsEntry("reason", "Annual test");
        verify(audit).logAs(eq(actor), eq("BACKUP"), eq(BACKUP), eq(id), eq("RESTORE_REHEARSAL_REQUESTED"), isNull(), eq("QUEUED"), anyString());
    }

    @Test
    void aRefusedRequestKeepsTheAgentsAnswerAndIsNotAudited() {
        when(agent.exchange(eq(HttpMethod.POST), anyString(), any()))
                .thenReturn(new BackupAgentClient.Reply(409, json("{\"code\":\"REHEARSAL_BUSY\"}")));
        assertThat(controller.request(BACKUP, new BackupRehearsalController.RehearsalRequest("why")).getBody().path("code").asText()).isEqualTo("REHEARSAL_BUSY");
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }

    @Test
    void theListPassesBoundedParametersOn() {
        when(agent.exchange(eq(HttpMethod.GET), anyString(), isNull())).thenReturn(new BackupAgentClient.Reply(200, json("{\"data\":[]}")));
        controller.list("a&b", "PASSED", BACKUP, "status", "asc", 0, 5000);
        ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
        verify(agent).exchange(eq(HttpMethod.GET), path.capture(), isNull());
        assertThat(path.getValue()).startsWith("/internal/rehearsals?").contains("search=a%26b").contains("status=PASSED")
                .contains("backupNumber=" + BACKUP).contains("sortDirection=asc").contains("page=1").contains("limit=100");
    }
}
