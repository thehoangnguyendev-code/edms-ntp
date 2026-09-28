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
    Optional<AuthSession> findByRefreshTokenHash(String refreshTokenHash);
    List<AuthSession> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    List<AuthSession> findAllByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(UUID userId);
    List<AuthSession> findAllByUserIdInAndRevokedAtIsNullAndStatusAndExpiresAtAfter(Collection<UUID> userIds, AuthSession.SessionStatus status, Instant expiresAt);
    boolean existsByUserIdAndRevokedAtIsNullAndStatusAndExpiresAtAfter(UUID userId, AuthSession.SessionStatus status, Instant expiresAt);
    List<AuthSession> findAllByUserIdInAndRevokedAtIsNullAndStatusAndExpiresAtAfterAndLastActivityAtAfter(Collection<UUID> userIds, AuthSession.SessionStatus status, Instant expiresAt, Instant lastActivityAt);
    boolean existsByUserIdAndRevokedAtIsNullAndStatusAndExpiresAtAfterAndLastActivityAtAfter(UUID userId, AuthSession.SessionStatus status, Instant expiresAt, Instant lastActivityAt);
    Optional<AuthSession> findByPreviousRefreshTokenHash(String previousRefreshTokenHash);
}
