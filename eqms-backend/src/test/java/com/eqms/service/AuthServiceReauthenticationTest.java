package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.auth.AuthResponse;
import com.eqms.dto.auth.LoginChallengeResponse;
import com.eqms.dto.auth.ReauthenticateRequest;
import com.eqms.dto.auth.VerifyMfaRequest;
import com.eqms.entity.AuthSession;
import com.eqms.entity.LoginChallenge;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.LoginChallengeRepository;
import com.eqms.repository.MfaFactorRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unlocking an idle-locked session (GMP, owner decision 2026-11-02): the password first, then the second factor of the account, with the same account lockout as
 * signing in; every wrong entry is written to the Audit Trail.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceReauthenticationTest {
    @Mock private AuthSessionRepository sessionRepository;
    @Mock private LoginChallengeRepository challengeRepository;
    @Mock private MfaFactorRepository mfaFactorRepository;
    @Mock private TokenService tokenService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthAuditService auditService;
    @Mock private AuditTrailService trailService;
    @Mock private CurrentUserService currentUserService;
    @Mock(answer = org.mockito.Answers.RETURNS_DEEP_STUBS) private SystemConfigurationService systemConfigurationService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    private AuthService service;

    private final HttpServletRequest http = new MockHttpServletRequest();
    private UserAccount user;
    private AuthSession session;

    @BeforeEach
    void setUp() throws Exception {
        service = new AuthService(mock(com.eqms.repository.UserAccountRepository.class), sessionRepository, challengeRepository, mfaFactorRepository,
                mock(com.eqms.repository.MfaTrustedDeviceRepository.class), mock(com.eqms.repository.PasswordResetTokenRepository.class), mock(com.eqms.repository.RoleDefinitionRepository.class),
                mock(PermissionEvaluationService.class), tokenService, mock(com.eqms.auth.TotpService.class), passwordEncoder, auditService, trailService, currentUserService,
                mock(UserManagementService.class), systemConfigurationService, mock(EmailService.class), notificationDispatcher, objectMapper,
                mock(com.eqms.maintenance.MaintenanceGateFilter.class), 15, 7, 5, 5);
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setUsername("an");
        user.setFullName("An Nguyen");
        user.setStatus(UserStatus.Active);
        user.setPasswordHash("hash");
        user.setMfaEmailFallbackEnabled(false); // an account without a second factor, unless a test gives it one
        user.setMfaEnabled(false);
        session = new AuthSession();
        session.setId(UUID.randomUUID());
        session.setUser(user);
        session.setStatus(AuthSession.SessionStatus.LOCKED);

        when(currentUserService.requireAuthenticatedPrincipal()).thenReturn(new AuthenticatedUser(user.getId(), session.getId(), "an", null, Set.of()));
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(sessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(passwordEncoder.matches("right", "hash")).thenReturn(true);
        when(passwordEncoder.matches(anyString(), eq("hash"))).thenAnswer(call -> "right".equals(call.getArgument(0)));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-otp");
        when(tokenService.createRefreshToken()).thenReturn("refresh");
        when(tokenService.hashToken(anyString())).thenAnswer(call -> "h:" + call.getArgument(0));
        when(tokenService.createAccessToken(any(), any())).thenReturn("access");
        com.fasterxml.jackson.databind.JsonNode security = new ObjectMapper().readTree("{\"enableAccountLockout\":true,\"maxLoginAttempts\":3}");
        when(systemConfigurationService.requireConfiguration().getSecurityConfig()).thenReturn(security);
    }

    private void withEmailMfa() {
        user.setMfaEmailFallbackEnabled(true);
    }

    private LoginChallenge challengeFor(UUID sessionId) {
        LoginChallenge challenge = new LoginChallenge();
        challenge.setUser(user);
        challenge.setSessionId(sessionId);
        challenge.setOtpHash("otp-hash");
        challenge.setOtpExpiresAt(Instant.now().plusSeconds(300));
        when(challengeRepository.findByMfaTokenHash("h:token")).thenReturn(Optional.of(challenge));
        return challenge;
    }

    private static VerifyMfaRequest code(String otp) {
        return new VerifyMfaRequest("token", otp, "email", false);
    }

    @Test
    void aWrongPasswordIsCountedLikeAtSignInAndWrittenToTheAuditTrail() {
        assertThatThrownBy(() -> service.reauthenticate(new ReauthenticateRequest("wrong"), http))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Password is incorrect. You have 2 login attempts remaining before your account is locked.");

        assertThat(user.getFailedLoginCount()).isEqualTo(1);
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.LOCKED);
        assertThat(session.getFailedReauthCount()).isEqualTo(1);
        verify(auditService).log(eq("session_reauth_failed"), eq(user), anyMap(), any(), any());
        verify(trailService).logSafely(eq("SESSION"), eq("Session"), eq(session.getId()), eq("SESSION_REAUTH_FAILED"), any(), any(), anyString());
    }

    @Test
    void theWrongPasswordThatReachesTheLimitLocksTheAccountAndEndsTheSession() {
        user.setFailedLoginCount(2);

        assertThatThrownBy(() -> service.reauthenticate(new ReauthenticateRequest("wrong"), http))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Account is locked after too many failed login attempts");

        assertThat(user.getLockedUntil()).isAfter(Instant.now());
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.REVOKED);
        verify(auditService).log(eq("account_locked"), eq(user), anyMap(), any(), any());
        verify(auditService).log(eq("session_revoked_after_lockout"), eq(user), anyMap(), any(), any());
        verify(notificationDispatcher).dispatch(eq("security.account_locked"), any(), anyMap());
    }

    @Test
    void aLockedAccountCannotUnlockASessionEvenWithTheRightPassword() {
        user.setLockedUntil(Instant.now().plusSeconds(3600));

        assertThatThrownBy(() -> service.reauthenticate(new ReauthenticateRequest("right"), http))
                .isInstanceOf(UnauthorizedException.class).hasMessageContaining("Account is locked");
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.LOCKED);
    }

    @Test
    void theRightPasswordOfAnAccountWithAnotherFactorDoesNotUnlockButAsksForTheCode() {
        withEmailMfa();

        Object result = service.reauthenticate(new ReauthenticateRequest("right"), http);

        assertThat(result).isInstanceOf(LoginChallengeResponse.class);
        LoginChallengeResponse challenge = (LoginChallengeResponse) result;
        assertThat(challenge.mfaRequired()).isTrue();
        assertThat(challenge.availableMethods()).containsExactly("email");
        assertThat(challenge.rememberDeviceAllowed()).isFalse();
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.LOCKED);
        ArgumentCaptor<LoginChallenge> saved = ArgumentCaptor.forClass(LoginChallenge.class);
        verify(challengeRepository).save(saved.capture());
        assertThat(saved.getValue().getSessionId()).isEqualTo(session.getId());
        verify(auditService).log(eq("session_reauth_password_verified"), eq(user), anyMap(), any(), any());
        verify(auditService, never()).log(eq("session_reauth_success"), any(UserAccount.class), anyMap(), any(), any());
    }

    @Test
    void anAccountWithoutAnyFactorIsUnlockedByThePassword() {
        Object result = service.reauthenticate(new ReauthenticateRequest("right"), http);

        assertThat(result).isInstanceOf(AuthResponse.class);
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.ACTIVE);
        verify(auditService).log(eq("session_reauth_success"), eq(user), anyMap(), any(), any());
    }

    @Test
    void aWrongCodeIsCountedLikeAWrongPasswordAndWrittenToTheAuditTrailWithItsMethod() {
        withEmailMfa();
        LoginChallenge challenge = challengeFor(session.getId());
        when(passwordEncoder.matches("000000", "otp-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.verifyReauthenticationMfa(code("000000"), http))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Verification code is incorrect. You have 2 login attempts remaining before your account is locked.");

        assertThat(user.getFailedLoginCount()).isEqualTo(1);
        assertThat(challenge.getAttemptCount()).isEqualTo(1);
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.LOCKED);
        ArgumentCaptor<Map<String, Object>> details = ArgumentCaptor.forClass(Map.class);
        verify(auditService).log(eq("session_reauth_failed"), eq(user), details.capture(), any(), any());
        assertThat(details.getValue()).containsEntry("factor", "verification_code").containsEntry("method", "email").containsEntry("attempt", 1);
        verify(trailService).logSafely(eq("SESSION"), eq("Session"), eq(session.getId()), eq("SESSION_REAUTH_FAILED"), any(), any(), anyString());
    }

    @Test
    void thePasswordAndTheCodeShareOneCounter() {
        withEmailMfa();
        challengeFor(session.getId());
        when(passwordEncoder.matches("000000", "otp-hash")).thenReturn(false);
        user.setFailedLoginCount(2); // two wrong passwords already

        assertThatThrownBy(() -> service.verifyReauthenticationMfa(code("000000"), http)).isInstanceOf(UnauthorizedException.class);

        assertThat(user.getLockedUntil()).isAfter(Instant.now());
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.REVOKED);
        verify(auditService).log(eq("account_locked"), eq(user), anyMap(), any(), any());
    }

    @Test
    void theRightCodeUnlocksTheSessionConsumesTheChallengeAndClearsTheFailures() {
        withEmailMfa();
        LoginChallenge challenge = challengeFor(session.getId());
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);
        user.setFailedLoginCount(1);

        AuthResponse response = service.verifyReauthenticationMfa(code("123456"), http);

        assertThat(response.accessToken()).isEqualTo("access");
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.ACTIVE);
        assertThat(challenge.getConsumedAt()).isNotNull();
        assertThat(user.getFailedLoginCount()).isZero();
        verify(auditService).log(eq("session_reauth_success"), eq(user), anyMap(), any(), any());
    }

    @Test
    void aSignInChallengeOrAnotherSessionsChallengeCannotUnlockThisSession() {
        withEmailMfa();
        challengeFor(null);
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);
        assertThatThrownBy(() -> service.verifyReauthenticationMfa(code("123456"), http)).isInstanceOf(UnauthorizedException.class);

        challengeFor(UUID.randomUUID());
        assertThatThrownBy(() -> service.verifyReauthenticationMfa(code("123456"), http)).isInstanceOf(UnauthorizedException.class);
        assertThat(session.getStatus()).isEqualTo(AuthSession.SessionStatus.LOCKED);
    }

    @Test
    void aChallengeMadeToUnlockASessionCannotSignAnybodyIn() {
        withEmailMfa();
        challengeFor(session.getId());
        when(passwordEncoder.matches("123456", "otp-hash")).thenReturn(true);

        assertThatThrownBy(() -> service.verifyMfa(code("123456"), http)).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void aWrongCodeAtSignInIsNowCountedAndWrittenToTheAuditTrailToo() {
        withEmailMfa();
        LoginChallenge challenge = challengeFor(null);
        when(passwordEncoder.matches("000000", "otp-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.verifyMfa(code("000000"), http))
                .isInstanceOf(UnauthorizedException.class).hasMessageStartingWith("Verification code is incorrect");

        assertThat(user.getFailedLoginCount()).isEqualTo(1);
        assertThat(challenge.getAttemptCount()).isEqualTo(1);
        verify(auditService).log(eq("mfa_verification_failed"), eq(user), anyMap(), any(), any());
        verify(trailService).logAs(eq(user), eq("USER"), anyString(), eq(user.getId()), eq("LOGIN"), any(), eq("REVOKED"), anyString());
    }

    @Test
    void theUnlockCodeStepNeedsAnAlreadyLockedSession() {
        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        assertThatThrownBy(() -> service.verifyReauthenticationMfa(code("123456"), http))
                .isInstanceOf(UnauthorizedException.class).hasMessage("Session is not locked");
        verify(challengeRepository, never()).findByMfaTokenHash(anyString());
    }
}
