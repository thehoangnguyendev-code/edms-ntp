package com.eqms.repository;

import com.eqms.entity.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID>, JpaSpecificationExecutor<UserNotification> {
    Optional<UserNotification> findByIdAndRecipientUserIdAndDeletedAtIsNull(UUID id, UUID recipientUserId);

    long countByRecipientUserIdAndDeletedAtIsNull(UUID recipientUserId);

    long countByRecipientUserIdAndDeletedAtIsNullAndStatusIgnoreCase(UUID recipientUserId, String status);

    long countByRecipientUserIdAndDeletedAtIsNullAndScopeIgnoreCase(UUID recipientUserId, String scope);

    List<UserNotification> findAllByRecipientUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID recipientUserId);

    /** Candidates for {@code NotificationEscalationScheduler} -- still unread, never escalated
     * before. Per-policy {@code escalationAfterMinutes} threshold is applied in Java since it
     * varies per event code, not something a single SQL predicate can express here. */
    List<UserNotification> findAllByStatusIgnoreCaseAndEscalatedAtIsNullAndDeletedAtIsNull(String status);
}
