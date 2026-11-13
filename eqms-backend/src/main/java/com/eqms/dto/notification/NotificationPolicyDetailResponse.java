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
        String iconTone
) {
}
