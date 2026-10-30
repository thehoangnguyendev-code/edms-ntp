package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class StorageUsageAlertServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final StorageUsagePolicyService policies = mock(StorageUsagePolicyService.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final StorageUsageAlertService service = new StorageUsageAlertService(jdbc, policies, users, permissions, notifications);

    private UserAccount user(UserStatus status) {
        var user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(status);
        return user;
    }

    private void state(boolean notified, long budget, int percent) {
        when(policies.get()).thenReturn(new StorageUsagePolicyService.Policy(budget, percent));
        when(jdbc.queryForObject(contains("warning_notified FROM"), eq(Boolean.class))).thenReturn(notified);
    }

    @Test
    void thresholdComparisonIsExactAndDoesNotOverflow() {
        assertTrue(StorageUsageAlertService.reached(80, 100L, 80));
        assertFalse(StorageUsageAlertService.reached(79, 100L, 80));
        assertFalse(StorageUsageAlertService.reached(Long.MAX_VALUE, null, 80));
        assertTrue(StorageUsageAlertService.reached(Long.MAX_VALUE, Long.MAX_VALUE, 100));
    }

    @Test
    void theActiveAdministratorsAreToldOnceWhenTheThresholdIsReached() {
        state(false, 100L, 80);
        var admin = user(UserStatus.Active);
        var suspended = user(UserStatus.Suspended);
        var ordinary = user(UserStatus.Active);
        when(users.findAll()).thenReturn(List.of(admin, suspended, ordinary));
        when(permissions.hasPermission(admin, "settings.configuration.manage")).thenReturn(true);
        when(permissions.hasPermission(suspended, "settings.configuration.manage")).thenReturn(true);

        assertEquals(1, service.afterSuccessfulScan(85));

        verify(notifications).recordNotification(eq(admin), any(), eq("personal"), eq("system"), eq("STORAGE_USAGE_WARNING"), any(), any(), eq("/settings/configuration"),
                any(), any(), any(), any(), eq("high"), any(), eq(true));
        verify(notifications, times(1)).recordNotification(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyBoolean());
        verify(jdbc).update(contains("warning_notified=true"));
    }

    @Test
    void nobodyIsToldAgainWhileTheUsageStaysOverTheThreshold() {
        state(true, 100L, 80);

        assertEquals(0, service.afterSuccessfulScan(95));

        verifyNoInteractions(notifications);
        verify(jdbc, never()).update(contains("warning_notified=true"));
    }

    @Test
    void theNoticeIsArmedAgainWhenTheUsageIsBackUnderTheThreshold() {
        state(true, 100L, 80);

        assertEquals(0, service.afterSuccessfulScan(50));

        verify(jdbc).update(contains("warning_notified=false"));
        verifyNoInteractions(notifications);
    }

    @Test
    void withoutABudgetNothingIsSent() {
        when(policies.get()).thenReturn(new StorageUsagePolicyService.Policy(null, 80));
        when(jdbc.queryForObject(contains("warning_notified FROM"), eq(Boolean.class))).thenReturn(false);

        assertEquals(0, service.afterSuccessfulScan(Long.MAX_VALUE));

        verifyNoInteractions(notifications);
    }

    @Test
    void aFailureToNotifyNeverEscapesTheMeasurement() {
        when(policies.get()).thenThrow(new IllegalStateException("database down"));

        assertEquals(0, service.afterSuccessfulScan(1));
    }
}
