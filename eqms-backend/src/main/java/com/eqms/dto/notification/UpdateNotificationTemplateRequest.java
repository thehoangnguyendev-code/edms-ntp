package com.eqms.dto.notification;

public record UpdateNotificationTemplateRequest(
        String title,
        String summary,
        String subject,
        String body,
        String actionUrlTemplate,
        String changeSummary,
        /** The words on the email button. */
        String actionLabel,
        /** The "Updated" time of the notification as the person saw it when they opened it (see UpdateNotificationPolicyRequest). */
        java.time.Instant expectedUpdatedAt
) {
    public UpdateNotificationTemplateRequest(String title, String summary, String subject, String body, String actionUrlTemplate, String changeSummary, String actionLabel) {
        this(title, summary, subject, body, actionUrlTemplate, changeSummary, actionLabel, null);
    }
}
