package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Disaster recovery drills (SDS 15.2): permissions, the checks before the agent, and the audit of a recorded drill. */
class BackupDrDrillControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupDrDrillController controller;

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
        controller = new BackupDrDrillController(users, permissions, agent, audit);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("dr.lead");
        allow("backup.admin.disaster_recovery.view", "backup.admin.disaster_recovery.manage");
    }

    @Test
    void viewingAndRecordingNeedTheirOwnPermissions() {
        allow("backup.admin.disaster_recovery.view");
        assertThatThrownBy(() -> controller.record(new BackupDrDrillController.DrillBody("SERVER_LOSS", "2026-10-12T02:00:00Z", "x", 5.0, "PASSED", null)))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);
    }

    @Test
    void aDrillIsRefusedBeforeTheAgentWhenItsScenarioTimeOrResultIsMissing() {
        assertThatThrownBy(() -> controller.record(new BackupDrDrillController.DrillBody(null, "2026-10-12T02:00:00Z", "x", 5.0, "PASSED", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("DRILL_SCENARIO_UNKNOWN"));
        assertThatThrownBy(() -> controller.record(new BackupDrDrillController.DrillBody("SERVER_LOSS", "2026-10-12T02:00:00Z", "x", null, "PASSED", null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("DRILL_TIME_INVALID"));
        assertThatThrownBy(() -> controller.record(new BackupDrDrillController.DrillBody("SERVER_LOSS", "2026-10-12T02:00:00Z", "x", 5.0, null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("DRILL_RESULT_UNKNOWN"));
        verifyNoInteractions(agent);
    }

    @Test
    void aRecordedDrillIsAuditedWithItsCode() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/dr/drills"), any()))
                .thenReturn(new BackupAgentClient.Reply(201, JSON.readTree("{\"drillCode\":\"DR-20261013-001\"}")));
        assertThat(controller.record(new BackupDrDrillController.DrillBody("SERVER_LOSS", "2026-10-12T02:00:00Z", "Pham Quoc Dung", 19.5, "PASSED", null))
                .getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(audit).logAs(eq(actor), eq("DR_DRILL"), eq("DR-20261013-001"), notNull(), eq("DR_DRILL_RECORDED"), isNull(), eq("PASSED"), anyString());
    }

    @Test
    void aRefusedDrillIsNotAudited() throws Exception {
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/dr/drills"), any()))
                .thenReturn(new BackupAgentClient.Reply(400, JSON.readTree("{\"code\":\"DRILL_OVER_TARGET\"}")));
        controller.record(new BackupDrDrillController.DrillBody("DATA_CORRUPTION", "2026-10-12T02:00:00Z", "x", 9.0, "PASSED", null));
        verifyNoInteractions(audit);
    }
}
