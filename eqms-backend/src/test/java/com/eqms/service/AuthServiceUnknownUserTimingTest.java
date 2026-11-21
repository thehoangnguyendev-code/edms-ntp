package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.auth.LoginRequest;
import com.eqms.dto.auth.SessionResponse;
import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.auth.UnauthorizedException;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Sign-in of an unknown name costs the same hash work as a wrong password; the session list shows only sessions that can still be used. */
class AuthServiceUnknownUserTimingTest {

    private final PasswordEncoder passwordEncoder = Mockito.mock(PasswordEncoder.class);
    private final UserAccountRepository userAccountRepository = Mockito.mock(UserAccountRepository.class);
    private final CurrentUserService currentUserService = Mockito.mock(CurrentUserService.class);
    private final AuthSessionRepository sessionRepository = Mockito.mock(AuthSessionRepository.class);
    private final AuthAuditService authAudit = Mockito.mock(AuthAuditService.class);
    private final AuthService service = build();

    /** The one constructor with a mock for every collaborator (zero for the numbers); only the encoder and the user lookup matter here. */
    private AuthService build() {
        try {
            var constructor = AuthService.class.getConstructors()[0];
            Object[] args = new Object[constructor.getParameterCount()];
            Class<?>[] types = constructor.getParameterTypes();
            for (int i = 0; i < args.length; i++) {
                if (types[i] == long.class) args[i] = 0L;
                else if (types[i] == int.class) args[i] = 0;
                else if (types[i] == boolean.class) args[i] = false;
                else if (types[i] == PasswordEncoder.class) args[i] = passwordEncoder;
                else if (types[i] == UserAccountRepository.class) args[i] = userAccountRepository;
                else if (types[i] == CurrentUserService.class) args[i] = currentUserService;
                else if (types[i] == AuthSessionRepository.class) args[i] = sessionRepository;
                else if (types[i] == AuthAuditService.class) args[i] = authAudit;
                else args[i] = Mockito.mock(types[i]);
            }
            return (AuthService) constructor.newInstance(args);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void unknownNameStillSpendsAPasswordHashAndKeepsTheMessage() {
        when(passwordEncoder.encode(anyString())).thenReturn("hash-of-the-same-cost");

        UnauthorizedException refused = assertThrows(UnauthorizedException.class,
                () -> service.login(new LoginRequest("no.such.person", "whatever"), null));

        assertEquals("Username or email not found", refused.getMessage());
        verify(passwordEncoder, atLeastOnce()).matches("whatever", "hash-of-the-same-cost");
    }

    private AuthSession session(UUID id, Instant expiresAt) {
        AuthSession session = new AuthSession();
        session.setId(id);
        session.setExpiresAt(expiresAt);
        session.setLastActivityAt(Instant.now());
        return session;
    }

    @Test
    void sessionListHasOnlySessionsThatCanStillBeUsed() {
        UUID userId = UUID.randomUUID();
        UUID live = UUID.randomUUID();
        UUID expired = UUID.randomUUID();
        when(currentUserService.requireAuthenticatedPrincipal()).thenReturn(new AuthenticatedUser(userId, live, "someone", "ROLE", Set.of()));
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId)).thenReturn(List.of(
                session(live, Instant.now().plusSeconds(3600)), session(expired, Instant.now().minusSeconds(60))));

        List<SessionResponse> listed = service.getSessions();

        assertEquals(1, listed.size());
        assertEquals(live.toString(), listed.get(0).sessionId());
        assertEquals(true, listed.get(0).current());
    }

    @Test
    void sessionListIsCapped() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.requireAuthenticatedPrincipal()).thenReturn(new AuthenticatedUser(userId, UUID.randomUUID(), "someone", "ROLE", Set.of()));
        List<AuthSession> many = new java.util.ArrayList<>();
        for (int i = 0; i < 250; i++) many.add(session(UUID.randomUUID(), Instant.now().plusSeconds(3600)));
        when(sessionRepository.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId)).thenReturn(many);

        assertEquals(100, service.getSessions().size());
    }

    @Test
    void aFailedSignInWithANameNobodyHasIsWrittenToTheAuthAuditLog() {
        when(passwordEncoder.encode(anyString())).thenReturn("hash");

        assertThrows(UnauthorizedException.class, () -> service.login(new LoginRequest("  probe.name  ", "x"), null));

        verify(authAudit).log(eq("login_failed"), (UserAccount) isNull(), argThat(details -> "probe.name".equals(details.get("username")) && Boolean.FALSE.equals(details.get("accountFound"))), any(), any());
    }

    @Test
    void aVeryLongNameIsCutAndAFailureToWriteNeverChangesTheAnswer() {
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        Mockito.doThrow(new IllegalStateException("audit table down")).when(authAudit).log(anyString(), (UserAccount) any(), any(), any(), any());

        UnauthorizedException refused = assertThrows(UnauthorizedException.class, () -> service.login(new LoginRequest("n".repeat(200), "x"), null));

        assertEquals("Username or email not found", refused.getMessage());
    }
}
