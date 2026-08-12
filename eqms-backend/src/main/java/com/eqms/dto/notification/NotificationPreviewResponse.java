package com.eqms.dto.notification;

public record NotificationPreviewResponse(
        String channel,
        String renderedTitle,
        String renderedSummary,
        String renderedSubject,
        String renderedBody,
        String renderedActionUrl
) {
}
