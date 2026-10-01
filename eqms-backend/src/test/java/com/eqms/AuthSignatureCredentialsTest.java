package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.auth.VerifySignatureRequest;
import com.eqms.entity.UserAccount;
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
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthSignatureCredentialsTest {
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final TokenService tokens = mock(TokenService.class);
    private final AuthAuditService audit = mock(AuthAuditService.class);
    private final UserAccount actor = new UserAccount();
    private AuthService service;

    @BeforeEach void setup() {
        actor.setId(UUID.randomUUID());
        actor.setUsername("admin");
        actor.setPasswordHash("hash");
        when(current.requireCurrentUser()).thenReturn(actor);
        service = new AuthService(null, null, null, null, null, null, null, null,
                tokens, null, passwords, audit, null, current, null, null, null, null, null,
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
