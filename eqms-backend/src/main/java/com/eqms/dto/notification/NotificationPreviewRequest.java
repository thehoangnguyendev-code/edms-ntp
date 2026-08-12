package com.eqms.dto.notification;

public record NotificationPreviewRequest(
        String channel,
        String title,
        String summary,
        String subject,
        String body,
        String actionUrlTemplate
) {
}
