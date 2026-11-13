package com.eqms.service;

import com.eqms.entity.SystemConfiguration;
import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class NotificationRetentionSchedulerTest {
    private final ObjectMapper json = new ObjectMapper();
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final SystemActorProvider actor = mock(SystemActorProvider.class);
    private final NotificationRetentionScheduler scheduler =
            new NotificationRetentionScheduler(jdbc, configuration, audit, actor, mock(DistributedSchedulerLockService.class));

    private void configured(String notificationsJson) throws Exception {
        SystemConfiguration config = mock(SystemConfiguration.class);
        when(config.getNotificationsConfig()).thenReturn(notificationsJson == null ? null : json.readTree(notificationsJson));
        when(configuration.requireConfiguration()).thenReturn(config);
    }

    @Test
    void defaultsTo180DaysWhenNotSet() throws Exception {
        configured("{}");
        assertEquals(180, scheduler.days());
        configured(null);
        assertEquals(180, scheduler.days());
    }

    @Test
    void zeroKeepsEverythingAndTouchesNothing() throws Exception {
        configured("{\"inAppRetentionDays\":0}");
        assertEquals(0, scheduler.run(Instant.now()));
        verifyNoInteractions(jdbc, audit);
    }

    @Test
    void deletesOnlyReadOlderThanCutoffInBatchesAndAudits() throws Exception {
        configured("{\"inAppRetentionDays\":90}");
        UserAccount system = mock(UserAccount.class);
        when(actor.get()).thenReturn(system);
        when(jdbc.update(anyString(), any(), anyInt())).thenReturn(5000, 120);
        Instant now = Instant.parse("2026-11-13T00:00:00Z");
        assertEquals(5120, scheduler.run(now));
        verify(jdbc, times(2)).update(contains("read_at is not null and read_at <"), eq(java.sql.Timestamp.from(now.minus(Duration.ofDays(90)))), eq(5000));
        verify(audit).logAs(eq(system), eq("NOTIFICATION"), anyString(), isNull(), eq("RETENTION_PURGE"), isNull(), isNull(), contains("5120"), anyList());
    }

    @Test
    void noAuditWhenNothingDeleted() throws Exception {
        configured("{\"inAppRetentionDays\":180}");
        when(jdbc.update(anyString(), any(), anyInt())).thenReturn(0);
        assertEquals(0, scheduler.run(Instant.now()));
        verifyNoInteractions(audit);
    }

    @Test
    void validationAcceptsZeroAndRangeOnly() throws Exception {
        SystemConfigurationService.validateNotificationRetention(json.readTree("{}"));
        SystemConfigurationService.validateNotificationRetention(json.readTree("{\"inAppRetentionDays\":0}"));
        SystemConfigurationService.validateNotificationRetention(json.readTree("{\"inAppRetentionDays\":30}"));
        SystemConfigurationService.validateNotificationRetention(json.readTree("{\"inAppRetentionDays\":3650}"));
        for (String bad : new String[]{"1", "29", "3651", "-5", "\"abc\"", "1.5"}) {
            assertThrows(IllegalArgumentException.class,
                    () -> SystemConfigurationService.validateNotificationRetention(json.readTree("{\"inAppRetentionDays\":" + bad + "}")), bad);
        }
    }
}
