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
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.util.MultiValueMap;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BackupRestoreControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupRestoreController controller;

    @BeforeEach
    void setUp() throws Exception {
        controller = new BackupRestoreController(users, permissions, agent, audit);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getFullName()).thenReturn("Quality Admin");
        when(actor.getUsername()).thenReturn("qadmin");
        allow("backup.module.view", "backup.backup.run", "backup.backup.verify");
        when(agent.post(anyString(), any())).thenReturn(JSON.readTree("{\"jobId\":\"" + UUID.randomUUID() + "\"}"));
        when(agent.get(anyString())).thenReturn(JSON.readTree("{}"));
        when(agent.get(anyString(), any())).thenReturn(JSON.readTree("{}"));
    }

    private void allow(String... codes) {
        when(permissions.hasAnyPermission(any(UserAccount.class), any(String[].class))).thenAnswer(inv -> {
            Object[] args = inv.getArguments();
            for (int i = 1; i < args.length; i++) {
                if (args[i] instanceof String s && java.util.Arrays.asList(codes).contains(s)) return true;
                if (args[i] instanceof String[] arr && java.util.Arrays.stream(arr).anyMatch(java.util.Arrays.asList(codes)::contains)) return true;
            }
            return false;
        });
    }

    @Test
    void everyReadNeedsTheViewPermission() {
        allow();
        assertThatThrownBy(() -> controller.overview()).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.list(null, null, null, null, null, null, null, null, "startedAt", "desc", 1, 10)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.get("BK-20261008-0200-0001")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.schedules()).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.job(UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void startingABackupNeedsItsOwnPermission() {
        allow("backup.module.view", "backup.backup.verify");
        assertThatThrownBy(() -> controller.create(new BackupRestoreController.CreateBackupRequest("because", null, null)))
                .isInstanceOf(AccessDeniedException.class);
        verify(agent, never()).post(anyString(), any());
        verifyNoInteractions(audit);
    }

    @Test
    void verifyingNeedsItsOwnPermission() {
        allow("backup.module.view", "backup.backup.run");
        assertThatThrownBy(() -> controller.verify("BK-20261008-0200-0001")).isInstanceOf(AccessDeniedException.class);
        verify(agent, never()).post(anyString(), any());
    }

    @Test
    void aBackupNeedsAReason() {
        for (String reason : new String[]{null, "", "   ", "x".repeat(501)}) {
            assertThatThrownBy(() -> controller.create(new BackupRestoreController.CreateBackupRequest(reason, null, null)))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("BACKUP_REASON_REQUIRED");
        }
        verify(agent, never()).post(anyString(), any());
    }

    @Test
    void aPreChangeBackupNeedsAChangeControlReference() {
        assertThatThrownBy(() -> controller.create(new BackupRestoreController.CreateBackupRequest("before upgrade", " ", "PRE_CHANGE")))
                .hasMessageContaining("BACKUP_CHANGE_REFERENCE_REQUIRED");
        assertThat(controller.create(new BackupRestoreController.CreateBackupRequest("before upgrade", "CC-2026-0150", "PRE_CHANGE")).getStatusCode())
                .isEqualTo(HttpStatus.ACCEPTED);
    }

    @Test
    void onlyKnownBackupTypesAreAccepted() {
        for (String type : new String[]{"INCREMENTAL", "PRE_RESTORE", "full", "DROP"}) {
            assertThatThrownBy(() -> controller.create(new BackupRestoreController.CreateBackupRequest("r", null, type)))
                    .hasMessageContaining("BACKUP_TYPE_NOT_ALLOWED");
        }
    }

    @Test
    void anAcceptedBackupIsAttributedToThePersonAndAudited() {
        var response = controller.create(new BackupRestoreController.CreateBackupRequest("  quarterly check  ", "", null));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(Map.class);
        verify(agent).post(eq("/internal/backups"), body.capture());
        assertThat(body.getValue()).containsEntry("requestedBy", "Quality Admin (qadmin)").containsEntry("reason", "quarterly check").containsEntry("type", "FULL");
        verify(audit).logAs(eq(actor), eq("BACKUP"), anyString(), any(UUID.class), eq("BACKUP_REQUESTED"), any(), eq("QUEUED"), org.mockito.ArgumentMatchers.contains("quarterly check"));
    }

    @Test
    void aBackupIdThatIsNotInTheAgentsShapeNeverReachesTheAgent() {
        for (String id : new String[]{"../etc/passwd", "BK-1", "BK-20261008-0200-0001/../../x", "bk-20261008-0200-0001", "BK-20261008-0200-0001 ", ""}) {
            assertThatThrownBy(() -> controller.get(id)).isInstanceOf(ResponseStatusException.class);
            assertThatThrownBy(() -> controller.verify(id)).isInstanceOf(ResponseStatusException.class);
        }
        verify(agent, never()).get(org.mockito.ArgumentMatchers.startsWith("/internal/backups/"));
        verify(agent, never()).post(org.mockito.ArgumentMatchers.startsWith("/internal/backups/"), any());
    }

    @Test
    void verifyingIsAttributedAndAudited() {
        var response = controller.verify("BK-20261008-0200-0001");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        verify(agent).post(eq("/internal/backups/BK-20261008-0200-0001/verify"), eq(Map.of("requestedBy", "Quality Admin (qadmin)")));
        verify(audit).logAs(eq(actor), eq("BACKUP"), eq("BK-20261008-0200-0001"), any(UUID.class), eq("BACKUP_VERIFY_REQUESTED"), any(), eq("QUEUED"), anyString());
    }

    @Test
    void theListPassesOnlyBoundedValuesToTheAgent() {
        controller.list("a".repeat(500), "COMPLETED", null, "", null, null, null, null, "startedAt", "asc", -5, 100000);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<MultiValueMap<String, String>> query = ArgumentCaptor.forClass(MultiValueMap.class);
        verify(agent).get(eq("/internal/backups"), query.capture());
        assertThat(query.getValue().getFirst("search")).hasSize(200);
        assertThat(query.getValue().getFirst("page")).isEqualTo("1");
        assertThat(query.getValue().getFirst("limit")).isEqualTo("100");
        assertThat(query.getValue()).doesNotContainKeys("type", "verification");
    }

    @Test
    void dateFiltersMustBeIsoInstantsAndArePassedOnNormalised() {
        controller.list(null, null, null, null, " 2026-10-01T00:00:00Z ", "2026-10-08T23:59:59.999Z", "2026-10-02T00:00:00Z", "2026-10-03T00:00:00Z", "startedAt", "desc", 1, 10);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<MultiValueMap<String, String>> query = ArgumentCaptor.forClass(MultiValueMap.class);
        verify(agent).get(eq("/internal/backups"), query.capture());
        assertThat(query.getValue().getFirst("startedFrom")).isEqualTo("2026-10-01T00:00:00Z");
        assertThat(query.getValue().getFirst("startedTo")).isEqualTo("2026-10-08T23:59:59.999Z");
        assertThat(query.getValue().getFirst("checkedFrom")).isEqualTo("2026-10-02T00:00:00Z");
        assertThat(query.getValue().getFirst("checkedTo")).isEqualTo("2026-10-03T00:00:00Z");
        for (String bad : new String[]{"yesterday", "2026-10-08", "1; drop table x"}) {
            assertThatThrownBy(() -> controller.list(null, null, null, null, null, null, bad, null, "startedAt", "desc", 1, 10))
                    .isInstanceOf(ResponseStatusException.class).hasMessageContaining("INVALID_DATE");
        }
    }

    @Test
    void theScheduleRowsNeedTheViewPermissionAndPassOnlyBoundedValues() {
        controller.scheduleRows("fi", "ACTIVE", "FULL", "DAILY", "time", "desc", 0, 5000);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<MultiValueMap<String, String>> query = ArgumentCaptor.forClass(MultiValueMap.class);
        verify(agent).get(eq("/internal/schedules/rows"), query.capture());
        assertThat(query.getValue().getFirst("page")).isEqualTo("1");
        assertThat(query.getValue().getFirst("limit")).isEqualTo("100");
        assertThat(query.getValue().getFirst("sortBy")).isEqualTo("time");
        assertThat(query.getValue().getFirst("type")).isEqualTo("FULL");
        assertThat(query.getValue().getFirst("frequency")).isEqualTo("DAILY");
        allow();
        assertThatThrownBy(() -> controller.scheduleRows(null, null, null, null, "component", "asc", 1, 10)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void anUnreachableAgentIsReportedAsUnavailableNotAsAnEmptyResult() {
        BackupAgentClient real = new BackupAgentClient("http://127.0.0.1:1", "0123456789abcdef");
        assertThatThrownBy(() -> real.get("/internal/overview"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(e.getReason()).isEqualTo("BACKUP_AGENT_UNAVAILABLE");
                });
    }

    @Test
    void jsonOfTheAgentIsPassedThroughUnchanged() throws Exception {
        JsonNode body = JSON.readTree("{\"environment\":\"DEV\",\"completed\":3}");
        when(agent.get("/internal/overview")).thenReturn(body);
        assertThat(controller.overview().getBody()).isEqualTo(body);
    }
}
