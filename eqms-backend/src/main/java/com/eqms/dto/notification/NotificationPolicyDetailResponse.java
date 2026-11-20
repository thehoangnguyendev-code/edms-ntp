package com.eqms.dto.notification;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

public record NotificationPolicyDetailResponse(
        String eventCode,
        String name,
        String description,
        String module,
        String priority,
        String relatedAction,
        String dataObject,
        String supportedChannels,
        String availableVariables,
        String policyStatus,
        String enabledChannels,
        JsonNode recipientRules,
        String digestMode,
        String quietHoursStart,
        String quietHoursEnd,
        boolean escalationEnabled,
        Integer escalationAfterMinutes,
        JsonNode escalationRecipientRules,
        String updatedByName,
        Instant updatedAt,
        List<NotificationTemplateVersionResponse> activeTemplates,
        String icon,
        /** The priority of the event in the catalog; {@code priority} is the one the notification is sent with (an administrator may have changed it). */
        String defaultPriority
) {
}
