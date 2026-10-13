package com.eqms.maintenance;

import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Everyone is signed out when the window drains, once per window, and the count goes to the ledger (SDS 11.5.2 M3). */
class MaintenanceSessionRevokerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuthSessionRepository sessions = mock(AuthSessionRepository.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    MaintenanceAdminAlerts alerts;
    MaintenanceSessionRevoker revoker;

    @BeforeEach
    void setUp() {
        alerts = mock(MaintenanceAdminAlerts.class);
        revoker = new MaintenanceSessionRevoker(agent, sessions, new TransactionTemplate(mock(PlatformTransactionManager.class)), alerts, permissions);
    }

    @Test
    void anAdministratorWithTheBypassKeepsTheSessionAndEveryoneElseIsSignedOut() throws Exception {
        AuthSession administrator = open();
        UserAccount adminUser = new UserAccount();
        administrator.setUser(adminUser);
        AuthSession other = open();
        when(sessions.findAllByRevokedAtIsNull()).thenReturn(List.of(administrator, other));
        when(permissions.hasPermission(adminUser, MaintenanceGateFilter.BYPASS_PERMISSION)).thenReturn(true);
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(status("LOCKED_RESTORING", "RQ-5", "t5"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), any())).thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{}")));

        assertThat(revoker.revokeIfDrained()).isEqualTo(1);
        assertThat(administrator.getRevokedAt()).isNull();
        assertThat(other.getRevokedAt()).isNotNull();
    }

    private BackupAgentClient.Reply status(String state, String requestId, String changedAt) throws Exception {
        return new BackupAgentClient.Reply(200, JSON.readTree("{\"state\":\"" + state + "\",\"requestId\":\"" + requestId + "\",\"changedAt\":\"" + changedAt + "\"}"));
    }

    private static AuthSession open() {
        AuthSession s = new AuthSession();
        s.setStatus(AuthSession.SessionStatus.ACTIVE);
        return s;
    }

    @Test
    void nothingHappensWhileTheSystemIsOpenOrOnNotice() throws Exception {
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(status("NORMAL", "RQ-1", "t1"));
        assertThat(revoker.revokeIfDrained()).isZero();
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(status("NOTICE", "RQ-1", "t1"));
        assertThat(revoker.revokeIfDrained()).isZero();
        verify(sessions, never()).findAllByRevokedAtIsNull();
    }

    @Test
    void whenDrainedEveryOpenSessionIsRevokedAndTheCountGoesToTheLedgerOnce() throws Exception {
        AuthSession a = open();
        AuthSession b = open();
        when(sessions.findAllByRevokedAtIsNull()).thenReturn(List.of(a, b));
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(status("DRAINED", "RQ-2", "t2"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), any())).thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{\"recorded\":true}")));

        assertThat(revoker.revokeIfDrained()).isEqualTo(2);
        assertThat(a.getRevokedAt()).isNotNull();
        assertThat(a.getStatus()).isEqualTo(AuthSession.SessionStatus.REVOKED);
        assertThat(b.getStatus()).isEqualTo(AuthSession.SessionStatus.REVOKED);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass((Class<Map<String, Object>>) (Class<?>) Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), body.capture());
        Map<String, Object> sent = body.getValue();
        assertThat(sent).containsEntry("event", "MAINTENANCE_SESSIONS_REVOKED").containsEntry("requestId", "RQ-2");

        // the same window again: nothing more to do, nothing more recorded
        assertThat(revoker.revokeIfDrained()).isZero();
        verify(agent, times(1)).exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), any());
        verify(alerts, times(1)).drained("RQ-2", 2);
    }

    @Test
    void aLockedWindowIsSignedOutToo() throws Exception {
        when(sessions.findAllByRevokedAtIsNull()).thenReturn(List.of(open()));
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(status("LOCKED_RESTORING", "RQ-3", "t3"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), any())).thenReturn(new BackupAgentClient.Reply(200, JSON.readTree("{}")));
        assertThat(revoker.revokeIfDrained()).isEqualTo(1);
    }

    @Test
    void ifTheLedgerDoesNotTakeTheRecordTheWindowIsTriedAgain() throws Exception {
        when(sessions.findAllByRevokedAtIsNull()).thenReturn(List.of());
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(status("DRAINED", "RQ-4", "t4"));
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), any())).thenReturn(new BackupAgentClient.Reply(500, JSON.readTree("{}")));
        revoker.revokeIfDrained();
        revoker.revokeIfDrained();
        verify(agent, times(2)).exchange(eq(HttpMethod.POST), eq("/internal/maintenance/event"), any());
    }

    @Test
    void anUnreachableAgentChangesNothing() throws Exception {
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/maintenance"), isNull())).thenReturn(new BackupAgentClient.Reply(503, JSON.readTree("{}")));
        assertThat(revoker.revokeIfDrained()).isZero();
        verify(sessions, never()).findAllByRevokedAtIsNull();
    }
}
