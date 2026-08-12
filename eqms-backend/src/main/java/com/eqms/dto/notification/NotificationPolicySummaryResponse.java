package com.eqms.dto.notification;

import java.time.Instant;

public record NotificationPolicySummaryResponse(
        String eventCode,
        String name,
        String description,
        String module,
        String priority,
        String complianceGroup,
        boolean mandatory,
        String supportedChannels,
        String policyStatus,
        String enabledChannels,
        boolean escalationEnabled,
        Instant updatedAt
) {
}
