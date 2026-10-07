package com.eqms;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.NotificationRealtimeService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemMonitoringRealtimeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The System monitoring cards refresh themselves over the existing event stream: a data-free event goes only to connected users
 * who hold dashboard.admin.view, and only while someone is connected.
 */
class SystemMonitoringRealtimeServiceTest {

    private final NotificationRealtimeService realtime = mock(NotificationRealtimeService.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final UUID admin = UUID.randomUUID();
    private final UUID clerk = UUID.randomUUID();
    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-07T10:00:00Z"));
    private final Clock clock = new Clock() {
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    };
    private SystemMonitoringRealtimeService service;

    @BeforeEach
    void setUp() throws Exception {
        Constructor<SystemMonitoringRealtimeService> constructor = SystemMonitoringRealtimeService.class.getDeclaredConstructor(
                NotificationRealtimeService.class, UserAccountRepository.class, PermissionEvaluationService.class, Clock.class);
        constructor.setAccessible(true);
        service = constructor.newInstance(realtime, users, permissions, clock);

        UserAccount adminAccount = new UserAccount();
        adminAccount.setId(admin);
        UserAccount clerkAccount = new UserAccount();
        clerkAccount.setId(clerk);
        when(users.findById(admin)).thenReturn(Optional.of(adminAccount));
        when(users.findById(clerk)).thenReturn(Optional.of(clerkAccount));
        when(permissions.hasPermission(adminAccount, "dashboard.admin.view")).thenReturn(true);
        when(permissions.hasPermission(clerkAccount, "dashboard.admin.view")).thenReturn(false);
        when(realtime.connectedUserIds()).thenReturn(Set.of(admin, clerk));
    }

    @Test
    void only_a_connected_user_who_may_see_the_dashboard_gets_the_event_and_it_carries_no_data() {
        service.push();

        verify(realtime).publishUserEvent(admin, "system-monitoring-changed");
        verify(realtime, never()).publishUserEvent(eq(clerk), anyString());
        verify(realtime, never()).publishGlobalEvent(anyString());
        verify(realtime, never()).publishUserEvent(any(), anyString(), any());
    }

    @Test
    void nobody_connected_means_nothing_is_looked_up_or_sent() {
        when(realtime.connectedUserIds()).thenReturn(Set.of());

        service.push();

        verifyNoInteractions(users, permissions);
        verify(realtime, never()).publishUserEvent(any(), anyString());
    }

    @Test
    void the_permission_is_looked_up_once_a_minute_not_every_tick_and_a_withdrawn_permission_stops_the_events() {
        service.push();
        now.set(now.get().plusSeconds(10));
        service.push();
        verify(users, times(1)).findById(admin);
        verify(realtime, times(2)).publishUserEvent(admin, "system-monitoring-changed");

        // After a minute the permission is checked again: withdrawn since, so no more events for that user.
        UserAccount adminAccount = users.findById(admin).orElseThrow();
        when(permissions.hasPermission(adminAccount, "dashboard.admin.view")).thenReturn(false);
        now.set(now.get().plusSeconds(61));
        Mockito.clearInvocations(realtime);
        service.push();

        verify(realtime, never()).publishUserEvent(eq(admin), anyString());
    }

    @Test
    void a_failure_while_looking_up_a_user_sends_nothing_to_that_user_and_does_not_stop_the_schedule() {
        when(permissions.hasPermission(any(), anyString())).thenThrow(new IllegalStateException("db down"));

        service.push();

        verify(realtime, never()).publishUserEvent(any(), anyString());
        // The next tick runs again (no exception escaped).
        service.push();
    }
}
