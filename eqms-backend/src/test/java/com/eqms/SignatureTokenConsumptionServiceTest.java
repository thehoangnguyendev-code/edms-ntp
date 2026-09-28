package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UsedSignatureTokenRepository;
import com.eqms.service.SignatureTokenConsumptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for DC-XF-83: a signature JWT must be usable exactly once. Previously
 * validateSigningRules()/requireValidSignatureToken() only checked the token's validity/expiry and
 * that it belonged to the current user -- the same 5-minute-TTL token could be replayed to authorize
 * any number of unrelated GMP actions.
 */
@ExtendWith(MockitoExtension.class)
class SignatureTokenConsumptionServiceTest {

    @Mock private TokenService tokenService;
    @Mock private UsedSignatureTokenRepository usedSignatureTokenRepository;

    @InjectMocks
    private SignatureTokenConsumptionService service;

    private UserAccount user;
    private UUID tokenId;

    @BeforeEach
    void setUp() {
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        tokenId = UUID.randomUUID();

        TokenService.ParsedAccessToken parsed = new TokenService.ParsedAccessToken(
                "signature",
                new AuthenticatedUser(user.getId(), tokenId, "testuser", "USER", java.util.Collections.emptySet())
        );
        when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(parsed));
    }

    @Test
    void requireAndConsume_secondCallWithSameToken_inADifferentTransaction_isRejected() {
        // First use: succeeds, durably records the token.
        UUID returnedId = service.requireAndConsume("raw-jwt", user);
        assertEquals(tokenId, returnedId);

        // Simulate the DB unique constraint rejecting a second, genuinely separate consumption
        // attempt for the same token (a different HTTP request/transaction replaying it) -- no
        // TransactionSynchronizationManager resource is bound outside a real Spring transaction in
        // this unit test, so the repository is hit again exactly like a real replay would be.
        when(usedSignatureTokenRepository.save(any()))
                .thenThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint"));

        assertThrows(UnauthorizedException.class, () -> service.requireAndConsume("raw-jwt", user));
    }

    @Test
    void requireAndConsume_tokenBelongingToDifferentUser_isRejected() {
        UserAccount otherUser = new UserAccount();
        otherUser.setId(UUID.randomUUID());

        assertThrows(UnauthorizedException.class, () -> service.requireAndConsume("raw-jwt", otherUser));
    }

    @Test
    void requireAndConsume_invalidToken_isRejected() {
        when(tokenService.parseSignatureToken("bad-token")).thenReturn(Optional.empty());

        assertThrows(UnauthorizedException.class, () -> service.requireAndConsume("bad-token", user));
    }
}
