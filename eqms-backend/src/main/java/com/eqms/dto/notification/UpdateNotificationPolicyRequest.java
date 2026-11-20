package com.eqms.dto.notification;

import com.fasterxml.jackson.databind.JsonNode;

/** Any field left null is left unchanged (partial update). Every notification can be switched off, given other channels and other recipients by an
 * administrator (D6: no notification is locked); the change is validated and written to the Audit Trail by NotificationPolicyService.updatePolicy.
 * {@code enabledChannels} is the list of channels the notification is sent on (IN_APP, EMAIL), a subset of the channels the event supports. */
public record UpdateNotificationPolicyRequest(
        String status,
        JsonNode recipientRules,
        String digestMode,
        String quietHoursStart,
        String quietHoursEnd,
        Boolean escalationEnabled,
        Integer escalationAfterMinutes,
        JsonNode escalationRecipientRules,
        java.util.List<String> enabledChannels,
        /** The "Updated" time of the notification as the person saw it when they opened it; when another change was saved since, the change is refused. Empty skips the check. */
        java.time.Instant expectedUpdatedAt,
        /** LOW, MEDIUM or HIGH; the default of the event puts the notification back to it. Null leaves it unchanged. */
        String priority
) {
    /** The request without a change of priority. */
    public UpdateNotificationPolicyRequest(String status, JsonNode recipientRules, String digestMode, String quietHoursStart, String quietHoursEnd,
                                           Boolean escalationEnabled, Integer escalationAfterMinutes, JsonNode escalationRecipientRules,
                                           java.util.List<String> enabledChannels, java.time.Instant expectedUpdatedAt) {
        this(status, recipientRules, digestMode, quietHoursStart, quietHoursEnd, escalationEnabled, escalationAfterMinutes, escalationRecipientRules, enabledChannels, expectedUpdatedAt, null);
    }

    /** The request without a change of channels. */
    public UpdateNotificationPolicyRequest(String status, JsonNode recipientRules, String digestMode, String quietHoursStart, String quietHoursEnd,
                                           Boolean escalationEnabled, Integer escalationAfterMinutes, JsonNode escalationRecipientRules) {
        this(status, recipientRules, digestMode, quietHoursStart, quietHoursEnd, escalationEnabled, escalationAfterMinutes, escalationRecipientRules, null, null, null);
    }

    public UpdateNotificationPolicyRequest(String status, JsonNode recipientRules, String digestMode, String quietHoursStart, String quietHoursEnd,
                                           Boolean escalationEnabled, Integer escalationAfterMinutes, JsonNode escalationRecipientRules, java.util.List<String> enabledChannels) {
        this(status, recipientRules, digestMode, quietHoursStart, quietHoursEnd, escalationEnabled, escalationAfterMinutes, escalationRecipientRules, enabledChannels, null, null);
    }
}
