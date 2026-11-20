package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.auth.VerifySignatureRequest;
import com.eqms.auth.AuthenticatedUser;
import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.service.NotificationDispatcher;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.eqms.service.AuthAuditService;
import com.eqms.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthSignatureCredentialsTest {
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final TokenService tokens = mock(TokenService.class);
    private final AuthAuditService audit = mock(AuthAuditService.class);
    private final AuthSessionRepository sessions = mock(AuthSessionRepository.class);
    private final NotificationDispatcher notifications = mock(NotificationDispatcher.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class, org.mockito.Answers.RETURNS_DEEP_STUBS);
    private final UserAccount actor = new UserAccount();
    private final AuthSession session = new AuthSession();
    private AuthService service;

    private void lockout(boolean enabled, int maxLogin, int maxSignature) throws Exception {
        when(configuration.requireConfiguration().getSecurityConfig())
                .thenReturn(new ObjectMapper().readTree("{\"enableAccountLockout\":" + enabled + ",\"maxLoginAttempts\":" + maxLogin
                        + ",\"maxSignatureAttempts\":" + maxSignature + "}"));
    }

    @BeforeEach void setup() throws Exception {
        actor.setId(UUID.randomUUID());
        actor.setUsername("admin");
        actor.setPasswordHash("hash");
        session.setId(UUID.randomUUID());
        session.setUser(actor);
        session.setStatus(AuthSession.SessionStatus.ACTIVE);
        when(current.requireCurrentUser()).thenReturn(actor);
        when(current.requireAuthenticatedPrincipal()).thenReturn(new AuthenticatedUser(actor.getId(), session.getId(), "admin", null, Set.of()));
        when(sessions.findById(session.getId())).thenReturn(Optional.of(session));
        lockout(true, 5, 5);
        service = new AuthService(null, sessions, null, null, null, null, null, null,
                tokens, null, passwords, audit, mock(com.eqms.service.AuditTrailService.class), current, null, configuration, null, notifications, null, null,
                15, 1, 5, 5);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" ", "\t"})
    void missingUsernameNeverIssuesToken(String username) {
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest(username, "secret")));
        verifyNoInteractions(passwords, tokens);
        verify(audit).log(eq("esign_verify_failed"), eq(actor), argThat(details -> "signature_username_missing".equals(details.get("reason"))), isNull(), isNull());
    }

    @Test void anotherAccountCannotSignForCurrentActor() {
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("other", "secret")));
        verifyNoInteractions(passwords, tokens);
        verify(audit).log(eq("esign_verify_failed"), eq(actor), argThat(details -> "signature_user_mismatch".equals(details.get("reason"))), isNull(), isNull());
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" "})
    void blankPasswordNeverIssuesToken(String password) {
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", password)));
        verifyNoInteractions(passwords, tokens);
    }

    @Test void wrongPasswordNeverIssuesToken() {
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", "wrong")));
        verify(passwords).matches("wrong", "hash");
        verifyNoInteractions(tokens);
        verify(audit).log(eq("esign_verify_failed"), eq(actor), anyMap(), isNull(), isNull());
    }

    // ---- a wrong password when signing has its own count and its own limit, apart from the wrong passwords at sign-in ----

    private void wrong(String password) {
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", password)));
    }

    @Test void aWrongPasswordWhenSigningIsCountedInItsOwnCountAndSaysSo() {
        var thrown = assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", "wrong")));
        assertEquals(1, actor.getFailedSignatureCount());
        assertEquals(0, actor.getFailedLoginCount());
        assertEquals("Password is incorrect. You have 4 signing attempts remaining before your account is locked.", thrown.getMessage());
        assertNull(actor.getLockedUntil());
    }

    @Test void wrongPasswordsAtSignInDoNotCountTowardSigning() {
        actor.setFailedLoginCount(4); // one more wrong password at sign-in would lock the account
        var thrown = assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", "wrong")));
        assertEquals(1, actor.getFailedSignatureCount());
        assertEquals(4, actor.getFailedLoginCount()); // untouched
        assertNull(actor.getLockedUntil());
        assertTrue(thrown.getMessage().contains("You have 4 signing attempts remaining"), thrown.getMessage());
    }

    @Test void theWrongEntryThatReachesTheSigningLimitLocksTheAccountAndEndsThatSession() {
        actor.setFailedSignatureCount(4);
        var thrown = assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", "wrong")));
        assertEquals("Account is locked after too many failed signing attempts. Please contact an administrator.", thrown.getMessage());
        assertNotNull(actor.getLockedUntil());
        assertTrue(actor.getLockedUntil().isAfter(Instant.now()));
        assertNotNull(session.getRevokedAt());
        assertEquals(AuthSession.SessionStatus.REVOKED, session.getStatus());
        verify(notifications).dispatch(eq("security.account_locked"), anyList(), anyMap());
        verify(audit).log(eq("account_locked"), eq(actor), argThat(details -> "auto_lockout_max_signature_attempts".equals(details.get("reason"))
                && Integer.valueOf(5).equals(details.get("failedSignatureCount"))), any(), any());
        verify(audit).log(eq("session_revoked_after_lockout"), eq(actor), anyMap(), any(), any());
        verifyNoInteractions(tokens);
    }

    @Test void theSigningLimitIsItsOwnSettingAndNotTheSignInLimit() throws Exception {
        lockout(true, 10, 3);
        actor.setFailedSignatureCount(2);
        wrong("wrong");
        assertNotNull(actor.getLockedUntil(), "the third wrong password when signing reaches a limit of 3 even though sign-in allows 10");

        actor.setLockedUntil(null);
        actor.setFailedSignatureCount(0);
        lockout(true, 3, 10);
        actor.setFailedSignatureCount(2);
        wrong("wrong");
        assertNull(actor.getLockedUntil(), "a sign-in limit of 3 does not lock the account at the third wrong password when signing");
    }

    @Test void aSettingThatIsMissingFromAnOlderConfigurationFallsBackToFive() throws Exception {
        when(configuration.requireConfiguration().getSecurityConfig()).thenReturn(new ObjectMapper().readTree("{\"enableAccountLockout\":true,\"maxLoginAttempts\":3}"));
        actor.setFailedSignatureCount(3);
        wrong("wrong");
        assertNull(actor.getLockedUntil());
        assertEquals(4, actor.getFailedSignatureCount());
    }

    @Test void aLockedAccountCannotSignEvenWithTheRightPassword() {
        actor.setLockedUntil(Instant.now().plusSeconds(3600));
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", "secret")));
        verifyNoInteractions(passwords, tokens);
    }

    @Test void aRightPasswordClearsTheSigningCountAndLeavesTheSignInCountAlone() {
        actor.setFailedSignatureCount(3);
        actor.setFailedLoginCount(2);
        when(passwords.matches("secret", "hash")).thenReturn(true);
        when(tokens.createSignatureToken(actor)).thenReturn("signed");
        service.verifySignature(new VerifySignatureRequest("admin", "secret"));
        assertEquals(0, actor.getFailedSignatureCount());
        assertEquals(2, actor.getFailedLoginCount());
    }

    @Test void withLockoutSwitchedOffTheAttemptsAreCountedButNobodyIsLockedOut() throws Exception {
        lockout(false, 5, 5);
        actor.setFailedSignatureCount(40);
        var thrown = assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("admin", "wrong")));
        assertEquals("Password is incorrect", thrown.getMessage());
        assertNull(actor.getLockedUntil());
        assertNull(session.getRevokedAt());
    }

    @Test void aBlankPasswordIsAFailedAttemptToo() {
        wrong("");
        assertEquals(1, actor.getFailedSignatureCount());
        verifyNoInteractions(passwords);
    }

    @Test void aNameThatIsNotTheSignersIsRefusedWithoutCountingAgainstTheAccount() {
        assertThrows(UnauthorizedException.class, () -> service.verifySignature(new VerifySignatureRequest("someone-else", "wrong")));
        assertEquals(0, actor.getFailedSignatureCount());
        assertEquals(0, actor.getFailedLoginCount());
    }

    @Test void successfulVerificationKeepsCurrentIdentityAndCaseInsensitiveUsernameHandling() {
        when(passwords.matches("secret", "hash")).thenReturn(true);
        when(tokens.createSignatureToken(actor)).thenReturn("signed");
        var result = service.verifySignature(new VerifySignatureRequest(" ADMIN ", "secret"));
        assertTrue(result.valid());
        assertEquals("admin", result.username());
        assertEquals(actor.getId().toString(), result.userId());
        assertEquals("signed", result.signatureToken());
        verify(audit).log(eq("esign_verify_success"), eq(actor), eq(java.util.Map.of()), isNull(), isNull());
    }

    @Test void authenticationFailureCommitsItsSecurityAuditTransaction() {
        var manager = new RecordingTransactions();
        var factory = new ProxyFactory(service);
        factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        var proxy = (AuthService) factory.getProxy();
        assertThrows(UnauthorizedException.class, () -> proxy.verifySignature(new VerifySignatureRequest("other", "secret")));
        assertEquals(1, manager.commits);
        assertEquals(0, manager.rollbacks);
        verify(audit).log(eq("esign_verify_failed"), eq(actor), anyMap(), isNull(), isNull());
        verifyNoInteractions(tokens);
    }

    private static class RecordingTransactions extends AbstractPlatformTransactionManager {
        int commits;
        int rollbacks;
        @Override protected Object doGetTransaction() { return new Object(); }
        @Override protected void doBegin(Object transaction, TransactionDefinition definition) {}
        @Override protected void doCommit(DefaultTransactionStatus status) { commits++; }
        @Override protected void doRollback(DefaultTransactionStatus status) { rollbacks++; }
    }
}
