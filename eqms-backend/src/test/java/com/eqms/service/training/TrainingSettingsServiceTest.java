package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TrainingSettingsServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingAccess access = mock(TrainingAccess.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final UserAccount actor = mock(UserAccount.class);
    private final TrainingSettingsService service = new TrainingSettingsService(jdbc, access, audit);

    private Map<String, Object> settings() {
        Map<String, Object> row = new HashMap<>();
        row.put("version", 1); row.put("pass_percent", 70); row.put("document_training_days_default", 10);
        row.put("annual_requirement_due_month", 12); row.put("annual_requirement_due_day", 31);
        row.put("absence_retrain_months", 6); row.put("retention_years_after_leaving", 10);
        row.put("review_ready_reminder_days", 3); row.put("review_open_reminder_days", 14);
        row.put("results_due_days", 7); row.put("results_due_day_type", "WORKING_MON_FRI");
        row.put("warn_scheduled_after_due", true); row.put("initial_training_days", 90);
        return row;
    }

    private TrainingSettingsService.SettingsWrite request(int version, String reason) {
        return new TrainingSettingsService.SettingsWrite(version, 80, null, null, null, null, null, null, null, null, reason, null, null, null);
    }

    @Test void recordsOldAndNewValuesWithoutInventingAReason() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(jdbc.queryForMap(anyString())).thenReturn(settings());
        service.update(actor, request(1, null));
        verify(access).require(actor, "training.settings.manage");
        verify(audit).logAs(eq(actor), eq("TRAINING_SETTINGS"), eq("TRAINING_SETTINGS"), any(UUID.class),
                eq("TRAINING_SETTINGS_UPDATED"), isNull(), isNull(), eq("Pass mark (%): 70 -> 80"));
    }

    private TrainingSettingsService.SettingsWrite onlyInitialDays(Integer days) {
        return new TrainingSettingsService.SettingsWrite(1, null, null, null, null, null, null, null, null, null, null, null, days, null);
    }

    @Test void theDaysAPersonCountsAsANewEmployeeAreSavedAndRecorded() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(jdbc.queryForMap(anyString())).thenReturn(settings());
        service.update(actor, onlyInitialDays(120));
        verify(audit).logAs(eq(actor), eq("TRAINING_SETTINGS"), eq("TRAINING_SETTINGS"), any(UUID.class),
                eq("TRAINING_SETTINGS_UPDATED"), isNull(), isNull(), eq("Days a person counts as a new employee: 90 -> 120"));
    }

    @Test void theDaysAPersonCountsAsANewEmployeeStayInTheLimitsOfTheColumn() {
        when(jdbc.queryForMap(anyString())).thenReturn(settings());
        for (int bad : new int[] {0, -1, 731}) {
            assertThatThrownBy(() -> service.update(actor, onlyInitialDays(bad))).isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_SETTINGS_INVALID");
        }
        verifyNoInteractions(audit);
    }

    /** SOP.0003 5.3.10: training records are kept at least 10 years after the employee leaves, so a shorter time is refused and nothing is written. */
    @Test void refusesToKeepTheRecordsLessThanTenYearsAfterTheEmployeeLeaves() {
        when(jdbc.queryForMap(anyString())).thenReturn(settings());
        assertThatThrownBy(() -> service.update(actor, new TrainingSettingsService.SettingsWrite(1, null, null, null, null, null, 9, null, null, null, null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_RETENTION_TOO_SHORT");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test void rejectsStaleVersionBeforeWritingOrAuditing() {
        when(jdbc.queryForMap(anyString())).thenReturn(settings());
        assertThatThrownBy(() -> service.update(actor, request(2, null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_SETTINGS_VERSION_CHANGED");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test void rejectsAnActorWithoutManagePermissionBeforeWritingOrAuditing() {
        doThrow(new AccessDeniedException("denied")).when(access).require(actor, "training.settings.manage");
        assertThatThrownBy(() -> service.update(actor, request(1, null))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(jdbc, audit);
    }

    @Test void keepsReasonsSuppliedByExistingApiClients() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(jdbc.queryForMap(anyString())).thenReturn(settings());
        service.update(actor, request(1, "Existing client reason"));
        verify(audit).logAs(eq(actor), eq("TRAINING_SETTINGS"), eq("TRAINING_SETTINGS"), any(UUID.class),
                eq("TRAINING_SETTINGS_UPDATED"), isNull(), isNull(), eq("Existing client reason | Pass mark (%): 70 -> 80"));
    }
}
