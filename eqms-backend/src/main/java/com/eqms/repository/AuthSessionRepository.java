package com.eqms.repository;

import com.eqms.entity.AuthSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Collection;
import java.util.UUID;

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID>, JpaSpecificationExecutor<AuthSession> {
    /** Sessions in the given status that were not revoked and have not expired at {@code now}. */
    long countByStatusAndRevokedAtIsNullAndExpiresAtAfter(AuthSession.SessionStatus status, Instant now);

    /** Sessions that are still open, for the maintenance window: everyone is signed out when the window drains (SDS 11.5.2 M3). */
    List<AuthSession> findAllByRevokedAtIsNull();

    Optional<AuthSession> findByRefreshTokenHash(String refreshTokenHash);
    List<AuthSession> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    List<AuthSession> findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(UUID userId);
    List<AuthSession> findAllByUserIdInAndRevokedAtIsNullAndStatusAndExpiresAtAfter(Collection<UUID> userIds, AuthSession.SessionStatus status, Instant expiresAt);
    boolean existsByUserIdAndRevokedAtIsNullAndStatusAndExpiresAtAfter(UUID userId, AuthSession.SessionStatus status, Instant expiresAt);
    List<AuthSession> findAllByUserIdInAndRevokedAtIsNullAndStatusAndExpiresAtAfterAndLastActivityAtAfter(Collection<UUID> userIds, AuthSession.SessionStatus status, Instant expiresAt, Instant lastActivityAt);
    boolean existsByUserIdAndRevokedAtIsNullAndStatusAndExpiresAtAfterAndLastActivityAtAfter(UUID userId, AuthSession.SessionStatus status, Instant expiresAt, Instant lastActivityAt);
    Optional<AuthSession> findByPreviousRefreshTokenHash(String previousRefreshTokenHash);
}
