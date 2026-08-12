package com.eqms.dto.notification;

import com.eqms.entity.NotificationDeliveryFailure;

import java.time.Instant;
import java.util.UUID;

public record NotificationDeliveryFailureResponse(
        UUID id,
        String recipient,
        String notificationType,
        String eventDomain,
        String errorMessage,
        int attempts,
        Instant createdAt,
        Instant lastAttemptAt,
        String status
) {
    public static NotificationDeliveryFailureResponse from(NotificationDeliveryFailure failure) {
        return new NotificationDeliveryFailureResponse(
                failure.getId(), failure.getRecipient(), failure.getNotificationType(),
                failure.getEventDomain(), failure.getErrorMessage(), failure.getAttempts(),
                failure.getCreatedAt(), failure.getLastAttemptAt(), failure.getStatus()
        );
    }
}
