package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eqms.entity.AuthSession;
import com.eqms.entity.AuthSessionChangeListener;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** The "Logged in Users" screen is told about session changes: scoped, once, and not on every token refresh. */
class UserSessionBroadcasterTest {

    private NotificationRealtimeService realtime;
    private UserAccountRepository users;
    private PermissionEvaluationService permissions;
    private UserSessionBroadcaster broadcaster;
    private UserAccount admin;
    private UserAccount staff;

    private static UserAccount user() {
        UserAccount account = new UserAccount();
        account.setId(UUID.randomUUID());
        return account;
    }

    @BeforeEach
    void setUp() {
        realtime = mock(NotificationRealtimeService.class);
        users = mock(UserAccountRepository.class);
        permissions = mock(PermissionEvaluationService.class);
        admin = user();
        staff = user();
        when(realtime.connectedUserIds()).thenReturn(Set.of(admin.getId(), staff.getId()));
        when(users.findAllById(anyCollection())).thenReturn(List.of(admin, staff));
        when(permissions.hasPermission(admin, "settings.user.view")).thenReturn(true);
        when(permissions.hasPermission(staff, "settings.user.view")).thenReturn(false);
        broadcaster = new UserSessionBroadcaster(realtime, users, permissions);
    }

    @Test
    @SuppressWarnings("unchecked")
    void onlyThePeopleWhoMayViewTheScreenAreToldAndTheSignalCarriesNoData() {
        UUID sessionId = UUID.randomUUID();
        broadcaster.publish(sessionId);

        ArgumentCaptor<java.util.Collection<UUID>> to = ArgumentCaptor.forClass(java.util.Collection.class);
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(realtime).publishEventToUsers(to.capture(), eq("entity-changed"), payload.capture());
        assertThat(to.getValue()).containsExactly(admin.getId());
        assertThat((java.util.Map<String, Object>) payload.getValue()).containsEntry("entityType", "USER_SESSION").containsEntry("id", sessionId.toString())
                .containsOnlyKeys("entityType", "id", "occurredAt");
    }

    @Test
    void aBurstInsideTheWindowIsOneSignal() {
        broadcaster.publish(UUID.randomUUID());
        broadcaster.publish(UUID.randomUUID());
        broadcaster.publish(UUID.randomUUID());
        verify(realtime, times(1)).publishEventToUsers(any(), any(), any());
    }

    @Test
    void nobodyIsToldWhenNobodyMayView() {
        when(permissions.hasPermission(admin, "settings.user.view")).thenReturn(false);
        broadcaster.publish(UUID.randomUUID());
        verify(realtime, never()).publishEventToUsers(any(), any(), any());
    }

    @Test
    void aViewerWhoConnectsLaterIsEvaluatedAtOnce() throws Exception {
        broadcaster.publish(UUID.randomUUID());
        UserAccount late = user();
        when(permissions.hasPermission(late, "settings.user.view")).thenReturn(true);
        when(realtime.connectedUserIds()).thenReturn(Set.of(admin.getId(), staff.getId(), late.getId()));
        when(users.findAllById(anyCollection())).thenReturn(List.of(late));
        Thread.sleep(UserSessionBroadcaster.MIN_INTERVAL_MS + 50);

        broadcaster.publish(UUID.randomUUID());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<java.util.Collection<UUID>> to = ArgumentCaptor.forClass(java.util.Collection.class);
        verify(realtime, times(2)).publishEventToUsers(to.capture(), any(), any());
        assertThat(to.getAllValues().get(1)).containsExactlyInAnyOrder(admin.getId(), late.getId());
    }

    // ---- what counts as a change of a session ----

    private static AuthSession session() {
        AuthSession session = new AuthSession();
        session.setId(UUID.randomUUID());
        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        session.setCurrentSession(true);
        session.setExpiresAt(Instant.now().plusSeconds(3600));
        return session;
    }

    @Test
    void aNewSessionIsAnnouncedAndATokenRefreshIsNot() throws Exception {
        AuthSessionChangeListener listener = new AuthSessionChangeListener();
        AuthSession session = session();
        listener.onCreate(session);
        verify(realtime, times(1)).publishEventToUsers(any(), any(), any());

        Thread.sleep(UserSessionBroadcaster.MIN_INTERVAL_MS + 50); // outside the rate window, so only the state check can hold it back
        session.setLastActivityAt(Instant.now());
        listener.onUpdate(session); // only the time moved: nothing to announce
        verify(realtime, times(1)).publishEventToUsers(any(), any(), any());

        session.setStatus(AuthSession.SessionStatus.LOCKED);
        listener.onUpdate(session);
        verify(realtime, times(2)).publishEventToUsers(any(), any(), any());
    }

    @Test
    void lockingAndRevokingAreChangesOfState() {
        AuthSessionChangeListener listener = new AuthSessionChangeListener();
        AuthSession session = session();
        listener.remember(session);

        session.setStatus(AuthSession.SessionStatus.LOCKED);
        assertThat(sessionStateChanged(session)).isTrue();
        listener.onUpdate(session);
        assertThat(sessionStateChanged(session)).isFalse();

        session.setRevokedAt(Instant.now());
        assertThat(sessionStateChanged(session)).isTrue();
    }

    @Test
    void aSessionThatWasNotLoadedThroughTheContextCountsAsChanged() {
        assertThat(sessionStateChanged(session())).isTrue();
    }

    // the state check is package-private on the entity; reach it through the listener's own contract
    private static boolean sessionStateChanged(AuthSession session) {
        try {
            var method = AuthSession.class.getDeclaredMethod("stateChangedSinceRemembered");
            method.setAccessible(true);
            return (boolean) method.invoke(session);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }
}
