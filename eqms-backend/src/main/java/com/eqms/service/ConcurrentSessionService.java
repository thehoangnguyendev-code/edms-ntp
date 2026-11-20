package com.eqms.service;

import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Limits how many sessions one account may have at the same time (Security configuration: Maximum Concurrent Sessions).
 *
 * <p>The newest sign-in wins: when a sign-in completes (after the second factor too) and the account is over the limit,
 * the oldest sessions are ended on the server and the browsers that hold them are told, so each one shows
 * "This session has ended because the account was signed in on another device." and goes back to the sign-in page.
 * A limit of 0 turns the rule off.
 */
@Service
public class ConcurrentSessionService {

    /** Server-sent event that tells a browser which of its account's sessions the server has just ended. */
    public static final String SESSION_REVOKED_EVENT = "session-revoked";
    /** Stable error code the browser acts on (response body of a refused request). */
    public static final String REVOKED_CODE = "SESSION_REVOKED_CONCURRENT_LIMIT";
    public static final String MESSAGE = "This session has ended because the account was signed in on another device.";

    private static final Logger log = LoggerFactory.getLogger(ConcurrentSessionService.class);

    private final AuthSessionRepository sessions;
    private final UserAccountRepository users;
    private final SystemConfigurationService configuration;
    private final NotificationRealtimeService realtime;
    private final AuthAuditService audit;
    private final AuditTrailService trail;

    public ConcurrentSessionService(AuthSessionRepository sessions, UserAccountRepository users, SystemConfigurationService configuration,
                                    NotificationRealtimeService realtime, AuthAuditService audit, AuditTrailService trail) {
        this.sessions = sessions;
        this.users = users;
        this.configuration = configuration;
        this.realtime = realtime;
        this.audit = audit;
        this.trail = trail;
    }

    /** The configured limit; 0 (or a missing setting) means no limit. */
    int limit() {
        var security = configuration.requireConfiguration().getSecurityConfig();
        int value = security == null ? 0 : security.path("maxConcurrentSessions").asInt(0);
        return Math.max(0, value);
    }

    /**
     * Makes room for {@code newSession}. Runs in the sign-in transaction: the user row is locked first, so two sign-ins of
     * the same account are decided one after the other and cannot both pass the limit.
     *
     * @return the ids of the sessions that were ended (empty when there is no limit or room was left)
     */
    public List<UUID> enforceLimit(UserAccount user, AuthSession newSession, String ipAddress, String userAgent) {
        int limit = limit();
        if (limit <= 0) {
            return List.of();
        }
        users.findByIdForUpdate(user.getId());
        Instant now = Instant.now();
        // Newest first. Only sessions that can still be used count: not revoked, not expired.
        List<AuthSession> others = sessions.findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(user.getId()).stream()
                .filter(s -> !s.getId().equals(newSession.getId()))
                .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(now))
                .filter(s -> s.getStatus() == AuthSession.SessionStatus.ACTIVE || s.getStatus() == AuthSession.SessionStatus.LOCKED)
                .toList();
        int keep = limit - 1; // the new session takes one place
        if (others.size() <= keep) {
            return List.of();
        }
        List<AuthSession> ended = others.subList(keep, others.size());
        for (AuthSession old : ended) {
            String from = old.getStatus().name();
            old.setRevokedAt(now);
            old.setCurrentSession(false);
            old.setStatus(AuthSession.SessionStatus.REVOKED);
            old.setRevokedReason(AuthSession.REVOKED_CONCURRENT_LIMIT);
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("endedSessionId", old.getId());
            details.put("newSessionId", newSession.getId());
            details.put("limit", limit);
            details.put("endedSessionIp", old.getIpAddress());
            details.put("newSessionIp", ipAddress);
            audit.log("SESSION_REVOKED_CONCURRENT_LIMIT", user, details, ipAddress, userAgent);
            trail.logSafely("SESSION", "Authentication Session", old.getId(), "SESSION_REVOKED", from, "REVOKED",
                    "Session ended: the account signed in on another device (limit " + limit + " per account)");
        }
        List<UUID> ids = ended.stream().map(AuthSession::getId).toList();
        announceAfterCommit(user.getId(), ids);
        return ids;
    }

    /** Tells the account's open browsers which sessions ended; each browser acts only on its own session id. Sent only once the sign-in is committed. */
    private void announceAfterCommit(UUID userId, List<UUID> sessionIds) {
        Runnable send = () -> {
            try {
                realtime.publishUserEvent(userId, SESSION_REVOKED_EVENT, Map.of(
                        "reason", AuthSession.REVOKED_CONCURRENT_LIMIT,
                        "sessionIds", sessionIds.stream().map(UUID::toString).toList()));
            } catch (RuntimeException ex) {
                log.warn("Could not tell the account's browsers that a session ended", ex); // the next request and the background check still find out
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }
}
