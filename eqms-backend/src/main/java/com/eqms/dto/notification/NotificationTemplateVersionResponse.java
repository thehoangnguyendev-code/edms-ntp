package com.eqms.dto.notification;

import java.time.Instant;

public record NotificationTemplateVersionResponse(
        String id,
        String channel,
        int versionNumber,
        String status,
        String title,
        String summary,
        String subject,
        String body,
        String actionUrlTemplate,
        String actionLabel,
        String variablesUsed,
        String changeSummary,
        String createdByName,
        Instant createdAt
) {
}
