package com.eqms;

import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.FileStorageService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.ReportPlatformService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression test for the schedule pause/resume/delete ownership-scope gap found during the
 * system-wide authorization audit: report.module.export (a broad legacy permission also used to
 * gate report generation) let any holder mutate ANOTHER user's report schedule, even though the
 * list view (schedules()) already restricted them to their own. requireScheduleManagement() now
 * mirrors the ownership check already used by runDetail()/download().
 */
class ReportScheduleOwnershipScopeTest {

    private JdbcTemplate jdbc;
    private PermissionEvaluationService permissions;
    private ReportPlatformService service;
    private UserAccount actor;
    private UUID scheduleId;
    private UUID otherOwnerId;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        permissions = mock(PermissionEvaluationService.class);
        service = new ReportPlatformService(
                jdbc,
                new ObjectMapper(),
                permissions,
                mock(DocumentRecordRepository.class),
                mock(UserAccountRepository.class),
                mock(DocumentAuthorizationService.class),
                mock(FileStorageService.class),
                mock(AuditTrailService.class)
        );
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        scheduleId = UUID.randomUUID();
        otherOwnerId = UUID.randomUUID();
    }

    @Test
    void deleteSchedule_ownedByAnotherUser_withOnlyLegacyExportPermission_isDenied() {
        when(permissions.hasPermission(actor, "reports.schedule.manage")).thenReturn(false);
        when(permissions.hasPermission(actor, "report.module.export")).thenReturn(true);
        when(jdbc.queryForMap(any(String.class), eq(scheduleId)))
                .thenReturn(Map.of("creator_user_id", otherOwnerId));

        assertThrows(SecurityException.class, () -> service.deleteSchedule(actor, scheduleId));
    }

    @Test
    void pauseSchedule_ownedByAnotherUser_withOnlyLegacyExportPermission_isDenied() {
        when(permissions.hasPermission(actor, "reports.schedule.manage")).thenReturn(false);
        when(permissions.hasPermission(actor, "report.module.export")).thenReturn(true);
        when(jdbc.queryForMap(any(String.class), eq(scheduleId)))
                .thenReturn(Map.of("creator_user_id", otherOwnerId));

        assertThrows(SecurityException.class, () -> service.pauseSchedule(actor, scheduleId));
    }

    @Test
    void deleteSchedule_ownScheduleWithoutManageAll_isAllowedThrough() {
        when(permissions.hasPermission(actor, "reports.schedule.manage")).thenReturn(false);
        when(permissions.hasPermission(actor, "report.module.export")).thenReturn(true);
        when(jdbc.queryForMap(any(String.class), eq(scheduleId)))
                .thenReturn(Map.of("creator_user_id", actor.getId()));

        service.deleteSchedule(actor, scheduleId);

        verify(jdbc).update(eq("delete from report_schedules where id=?"), eq(scheduleId));
    }

    @Test
    void deleteSchedule_manageAllPermission_allowsMutatingAnotherUsersSchedule() {
        when(permissions.hasPermission(actor, "reports.schedule.manage")).thenReturn(true);
        when(permissions.hasPermission(actor, "report.module.export")).thenReturn(true);
        when(jdbc.queryForMap(any(String.class), eq(scheduleId)))
                .thenReturn(Map.of("creator_user_id", otherOwnerId));

        service.deleteSchedule(actor, scheduleId);

        verify(jdbc).update(eq("delete from report_schedules where id=?"), eq(scheduleId));
    }
}
