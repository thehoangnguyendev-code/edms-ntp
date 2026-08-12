package com.eqms.dto.notification;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String type,
        String scope,
        String title,
        String description,
        String module,
        String moduleKey,
        String priority,
        String status,
        String createdAt,
        String readAt,
        String deletedAt,
        String actionUrl,
        NotificationUserResponse sender,
        NotificationUserResponse recipient,
        NotificationRelatedItemResponse relatedItem,
        JsonNode metadata
) {
}
