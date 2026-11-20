package com.eqms.service;

import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ConcurrentSessionServiceTest {

    private AuthSessionRepository sessions;
    private UserAccountRepository users;
    private SystemConfigurationService configuration;
    private NotificationRealtimeService realtime;
    private AuthAuditService audit;
    private AuditTrailService trail;
    private ConcurrentSessionService service;
    private UserAccount user;

    @BeforeEach
    void setUp() throws Exception {
        sessions = mock(AuthSessionRepository.class);
        users = mock(UserAccountRepository.class);
        configuration = mock(SystemConfigurationService.class, RETURNS_DEEP_STUBS);
        realtime = mock(NotificationRealtimeService.class);
        audit = mock(AuthAuditService.class);
        trail = mock(AuditTrailService.class);
        service = new ConcurrentSessionService(sessions, users, configuration, realtime, audit, trail);
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        limit(1);
    }

    private void limit(int value) throws Exception {
        when(configuration.requireConfiguration().getSecurityConfig())
                .thenReturn(new ObjectMapper().readTree("{\"maxConcurrentSessions\":" + value + "}"));
    }

    private AuthSession session(AuthSession.SessionStatus status, long createdSecondsAgo) {
        AuthSession s = new AuthSession();
        s.setId(UUID.randomUUID());
        s.setUser(user);
        s.setStatus(status);
        s.setCreatedAt(Instant.now().minusSeconds(createdSecondsAgo));
        s.setExpiresAt(Instant.now().plusSeconds(3600));
        return s;
    }

    private void existing(AuthSession... list) {
        List<AuthSession> all = new ArrayList<>(List.of(list));
        all.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())); // newest first, as the repository returns them
        when(sessions.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(user.getId())).thenReturn(all);
    }

    @Test
    void withLimitOneTheOlderSessionIsEndedAndMarkedWithTheReason() {
        AuthSession a = session(AuthSession.SessionStatus.ACTIVE, 600);
        AuthSession b = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(a, b);

        List<UUID> ended = service.enforceLimit(user, b, "10.0.0.2", "ua");

        assertEquals(List.of(a.getId()), ended);
        assertNotNull(a.getRevokedAt());
        assertEquals(AuthSession.SessionStatus.REVOKED, a.getStatus());
        assertEquals(AuthSession.REVOKED_CONCURRENT_LIMIT, a.getRevokedReason());
        assertFalse(a.isCurrentSession());
        assertNull(b.getRevokedAt());
        verify(users).findByIdForUpdate(user.getId());
        verify(audit).log(eq("SESSION_REVOKED_CONCURRENT_LIMIT"), eq(user), ArgumentMatchers.<Map<String, Object>>any(), eq("10.0.0.2"), eq("ua"));
        verify(realtime).publishUserEvent(eq(user.getId()), eq("session-revoked"), any());
        // the Audit Trail entry is written for the account that owns the session, as evidence (not through the best-effort logSafely that needs a signed-in actor)
        verify(trail).logAs(eq(user), eq("SESSION"), eq("Authentication Session"), any(), eq("SESSION_REVOKED"), any(), eq("REVOKED"), any());
    }

    @Test
    void aSessionThatIsBeingUsedRightNowIsEndedToo() {
        AuthSession busy = session(AuthSession.SessionStatus.ACTIVE, 600);
        busy.setLastActivityAt(Instant.now()); // active this second: still ended, the newest sign-in wins
        AuthSession fresh = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(busy, fresh);
        assertEquals(1, service.enforceLimit(user, fresh, null, null).size());
        assertEquals(AuthSession.SessionStatus.REVOKED, busy.getStatus());
    }

    @Test
    void aLockedSessionCountsAndIsEnded() {
        AuthSession locked = session(AuthSession.SessionStatus.LOCKED, 600);
        AuthSession fresh = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(locked, fresh);
        assertEquals(1, service.enforceLimit(user, fresh, null, null).size());
    }

    @Test
    void withLimitThreeTheTwoNewestOldOnesStayAndTheOldestEnds() throws Exception {
        limit(3);
        AuthSession oldest = session(AuthSession.SessionStatus.ACTIVE, 900);
        AuthSession middle = session(AuthSession.SessionStatus.ACTIVE, 600);
        AuthSession recent = session(AuthSession.SessionStatus.ACTIVE, 300);
        AuthSession fresh = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(oldest, middle, recent, fresh);

        assertEquals(List.of(oldest.getId()), service.enforceLimit(user, fresh, null, null));
        assertNull(middle.getRevokedAt());
        assertNull(recent.getRevokedAt());
    }

    @Test
    void nothingIsEndedWhenThereIsRoom() throws Exception {
        limit(2);
        AuthSession a = session(AuthSession.SessionStatus.ACTIVE, 600);
        AuthSession fresh = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(a, fresh);
        assertTrue(service.enforceLimit(user, fresh, null, null).isEmpty());
        assertNull(a.getRevokedAt());
        verifyNoInteractions(realtime);
    }

    @Test
    void limitZeroLeavesEverythingAsItIs() throws Exception {
        limit(0);
        AuthSession a = session(AuthSession.SessionStatus.ACTIVE, 600);
        AuthSession fresh = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(a, fresh);
        assertTrue(service.enforceLimit(user, fresh, null, null).isEmpty());
        assertNull(a.getRevokedAt());
        verifyNoInteractions(users, realtime, audit);
    }

    @Test
    void aMissingSettingMeansNoLimit() throws Exception {
        when(configuration.requireConfiguration().getSecurityConfig()).thenReturn(new ObjectMapper().readTree("{}"));
        assertTrue(service.enforceLimit(user, session(AuthSession.SessionStatus.ACTIVE, 0), null, null).isEmpty());
    }

    @Test
    void anExpiredSessionDoesNotCountAgainstTheLimit() {
        AuthSession expired = session(AuthSession.SessionStatus.ACTIVE, 600);
        expired.setExpiresAt(Instant.now().minusSeconds(5));
        AuthSession fresh = session(AuthSession.SessionStatus.ACTIVE, 0);
        existing(expired, fresh);
        assertTrue(service.enforceLimit(user, fresh, null, null).isEmpty());
        assertNull(expired.getRevokedAt());
    }
}
