package com.eqms.dto.notification;

public record UpdateNotificationTemplateRequest(
        String title,
        String summary,
        String subject,
        String body,
        String actionUrlTemplate,
        String changeSummary
) {
}
