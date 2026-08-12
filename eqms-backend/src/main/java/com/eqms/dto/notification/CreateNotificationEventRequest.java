package com.eqms.dto.notification;

public record CreateNotificationEventRequest(
        String code,
        String name,
        String description,
        String module,
        String priority,
        String complianceGroup,
        String relatedAction,
        String dataObject,
        String availableVariables,
        String actionUrlTemplate,
        boolean mandatory,
        String mandatoryReason
) {
}
