package com.eqms.dto.notification;

import com.fasterxml.jackson.databind.JsonNode;

/** Any field left null is left unchanged (partial update). Mandatory-event fields that GMP
 * locks (status/recipientRules on a mandatory event) are rejected server-side regardless of
 * what's sent here — see NotificationPolicyService.updatePolicy. This feature is in-app/webapp
 * notifications only, so there is no channel selection to update. */
public record UpdateNotificationPolicyRequest(
        String status,
        JsonNode recipientRules,
        String digestMode,
        String quietHoursStart,
        String quietHoursEnd,
        Boolean escalationEnabled,
        Integer escalationAfterMinutes,
        JsonNode escalationRecipientRules
) {
}
