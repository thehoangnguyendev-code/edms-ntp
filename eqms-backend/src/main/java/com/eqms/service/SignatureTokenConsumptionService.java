package com.eqms.service;

import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.entity.UsedSignatureToken;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UsedSignatureTokenRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.UUID;

/**
 * Single, shared choke point for consuming an Electronic Signature JWT (DC-XF-83). Previously
 * DocumentService, RevisionService, ControlledCopyService, and ElectronicSignatureService each had
 * their own copy of "parse token, check it belongs to the current user" -- none of them recorded
 * that the token had actually been used, so the same 5-minute-TTL token could be replayed to
 * authorize any number of unrelated GMP actions until it expired. This service parses once, confirms
 * ownership, then atomically inserts the token's unique "sid" claim into used_signature_tokens; a
 * second attempt to use the same token hits the primary key and is rejected.
 */
@Service
public class SignatureTokenConsumptionService {

    private final TokenService tokenService;
    private final UsedSignatureTokenRepository usedSignatureTokenRepository;

    public SignatureTokenConsumptionService(
            TokenService tokenService,
            UsedSignatureTokenRepository usedSignatureTokenRepository
    ) {
        this.tokenService = tokenService;
        this.usedSignatureTokenRepository = usedSignatureTokenRepository;
    }

    /**
     * Parses, validates ownership, and permanently consumes a signature token in one call. Returns
     * the token's unique id (previously misused elsewhere as a "session id" -- it is really a
     * per-token nonce) for callers that still want to reference it in audit trail entries.
     *
     * <p>Several existing action methods (e.g. ControlledCopyService.cancel/recall/print) validate
     * the signature token once at the top of the method and then pass the very same raw token a
     * second time into ElectronicSignatureService.createEntitySignature(...), which independently
     * validates it again -- both calls are part of the SAME action/transaction, not a replay. To
     * keep that existing call pattern working without weakening replay protection, consumption is
     * tracked per-transaction via Spring's TransactionSynchronizationManager: the first call within
     * a transaction durably records the token in used_signature_tokens; a second call for the same
     * token within that same transaction is treated as idempotent (no error, no duplicate insert).
     * A genuinely different transaction/request reusing the token still hits the DB unique
     * constraint and is rejected.</p>
     */
    @Transactional
    public UUID requireAndConsume(String rawToken, UserAccount currentUser) {
        if (!StringUtils.hasText(rawToken)) {
            throw new IllegalArgumentException("Electronic signature is required");
        }
        var parsed = tokenService.parseSignatureToken(rawToken)
                .orElseThrow(() -> new UnauthorizedException("Electronic signature is invalid or expired"));
        if (currentUser == null || !parsed.principal().userId().equals(currentUser.getId())) {
            throw new UnauthorizedException("Electronic signature must belong to the current user");
        }
        UUID tokenId = parsed.principal().sessionId();
        String txResourceKey = "signature-token-consumed:" + tokenId;
        if (TransactionSynchronizationManager.hasResource(txResourceKey)) {
            return tokenId;
        }
        try {
            usedSignatureTokenRepository.save(new UsedSignatureToken(tokenId, currentUser, Instant.now()));
        } catch (DataIntegrityViolationException alreadyUsed) {
            throw new UnauthorizedException("This electronic signature has already been used and cannot be reused");
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.bindResource(txResourceKey, Boolean.TRUE);
        }
        return tokenId;
    }

    /**
     * Validates ownership and that the token has not already been consumed, WITHOUT consuming it.
     * DC-XF-84: for actions accepted immediately but only actually signed later on an async worker
     * (Publishing Workspace's queue), calling this at accept time rejects an already-invalid/expired/
     * replayed token immediately instead of only discovering it minutes later when the worker finally
     * runs -- closing the "user thinks the signed command was accepted, but it silently fails later"
     * gap. This does not solve the token still expiring during a long queue wait or a backend restart
     * before the worker consumes it for real (that needs a persisted "signed intent" decoupled from
     * the JWT's own short TTL, which is a larger contract change tracked separately) -- it only moves
     * the obviously-already-bad-token case to fail fast.
     */
    @Transactional(readOnly = true)
    public void requireValidWithoutConsuming(String rawToken, UserAccount currentUser) {
        if (!StringUtils.hasText(rawToken)) {
            throw new IllegalArgumentException("Electronic signature is required");
        }
        var parsed = tokenService.parseSignatureToken(rawToken)
                .orElseThrow(() -> new UnauthorizedException("Electronic signature is invalid or expired"));
        if (currentUser == null || !parsed.principal().userId().equals(currentUser.getId())) {
            throw new UnauthorizedException("Electronic signature must belong to the current user");
        }
        if (usedSignatureTokenRepository.existsById(parsed.principal().sessionId())) {
            throw new UnauthorizedException("This electronic signature has already been used and cannot be reused");
        }
    }
}
