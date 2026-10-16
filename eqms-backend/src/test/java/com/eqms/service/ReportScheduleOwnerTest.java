package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** REPORT-SCHEDULE-OWNER-2026-10-14: a handover needs a named active person, a reason, and an audit record. */
class ReportScheduleOwnerTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final UUID scheduleId = UUID.randomUUID();
    private final UUID currentOwner = UUID.randomUUID();
    private final UUID newOwner = UUID.randomUUID();
    private final UserAccount actor = new UserAccount();
    private ReportPlatformService service;

    /** Typed matcher: keeps JdbcTemplate's varargs overload selected. */
    private static Object anyObj() {
        return org.mockito.ArgumentMatchers.<Object>any();
    }

    private static UserAccount person(UUID id, UserStatus status) {
        var account = new UserAccount();
        account.setId(id);
        account.setUsername("person." + id.toString().substring(0, 4));
        account.setStatus(status);
        return account;
    }

    @BeforeEach
    void setUp() {
        actor.setId(UUID.randomUUID());
        actor.setUsername("schedule.admin");
        actor.setStatus(UserStatus.Active);
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(true);
        when(jdbc.queryForMap(anyString(), anyObj())).thenReturn(Map.of(
                "name", "Monthly status", "owner_user_id", currentOwner.toString(), "creator_user_id", actor.getId().toString()));
        service = new ReportPlatformService(jdbc, new ObjectMapper(), permissions, mock(DocumentRecordRepository.class), users,
                mock(DocumentAuthorizationService.class), mock(FileStorageService.class), audit);
        when(users.findById(newOwner)).thenReturn(Optional.of(person(newOwner, UserStatus.Active)));
    }

    @Test
    void theHandoverNeedsAReason() {
        assertThatThrownBy(() -> service.changeScheduleOwner(actor, scheduleId, newOwner, "  "))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj());
    }

    @Test
    void theNewOwnerMustBeAnActivePerson() {
        when(users.findById(newOwner)).thenReturn(Optional.of(person(newOwner, UserStatus.Suspended)));
        assertThatThrownBy(() -> service.changeScheduleOwner(actor, scheduleId, newOwner, "Owner left the department"))
                .isInstanceOfSatisfying(IllegalArgumentException.class, e -> org.assertj.core.api.Assertions.assertThat(e.getMessage()).isEqualTo("REPORT_SCHEDULE_OWNER_INVALID"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj());
    }

    @Test
    void choosingTheCurrentOwnerAgainIsRefused() {
        when(users.findById(currentOwner)).thenReturn(Optional.of(person(currentOwner, UserStatus.Active)));
        assertThatThrownBy(() -> service.changeScheduleOwner(actor, scheduleId, currentOwner, "No change"))
                .isInstanceOfSatisfying(IllegalArgumentException.class, e -> org.assertj.core.api.Assertions.assertThat(e.getMessage()).isEqualTo("REPORT_SCHEDULE_OWNER_UNCHANGED"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj());
    }

    @Test
    void aHandoverIsWrittenAndAudited() {
        service.changeScheduleOwner(actor, scheduleId, newOwner, "  Owner transferred to QA  ");

        verify(jdbc).update(eq("update report_schedules set owner_user_id=?,updated_at=now() where id=?"), eq(newOwner), eq(scheduleId));
        verify(audit).logAs(eq(actor), eq("REPORT_SCHEDULE"), eq("Monthly status"), eq(scheduleId), eq("REPORT_SCHEDULE_OWNER_CHANGED"),
                eq(currentOwner.toString()), eq(newOwner.toString()), eq("Owner transferred to QA"));
    }
}
