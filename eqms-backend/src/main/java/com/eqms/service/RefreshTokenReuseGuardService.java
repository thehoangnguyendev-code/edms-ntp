package com.eqms.service;

import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthSessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/**
 * Detects replay of an already-rotated-out refresh token (a strong signal of theft) and revokes
 * the affected session. Runs in its own transaction (REQUIRES_NEW) so the revocation is committed
 * even though the caller immediately throws an UnauthorizedException that would otherwise roll
 * back everything done in the same transaction as the failed refresh attempt.
 */
@Service
public class RefreshTokenReuseGuardService {

    private final AuthSessionRepository sessionRepository;
    private final AuthAuditService auditService;
    private final AuditTrailService trailService;

    public RefreshTokenReuseGuardService(
            AuthSessionRepository sessionRepository,
            AuthAuditService auditService,
            AuditTrailService trailService
    ) {
        this.sessionRepository = sessionRepository;
        this.auditService = auditService;
        this.trailService = trailService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handlePossibleReuse(String presentedHash, HttpServletRequest httpRequest) {
        sessionRepository.findByPreviousRefreshTokenHash(presentedHash).ifPresent(session -> {
            UserAccount user = session.getUser();
            session.setStatus(AuthSession.SessionStatus.REVOKED);
            session.setRevokedAt(Instant.now());
            sessionRepository.save(session);
            auditService.log(
                    "refresh_token_reuse_detected",
                    user,
                    Map.of("sessionId", session.getId().toString()),
                    clientIp(httpRequest),
                    userAgent(httpRequest)
            );
            trailService.logAs(
                    user,
                    "SESSION",
                    "Authentication Session",
                    session.getId(),
                    "REFRESH_TOKEN_REUSE_DETECTED",
                    "ACTIVE",
                    "REVOKED",
                    "A previously-rotated refresh token was replayed; session revoked as a precaution"
            );
        });
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }
}
