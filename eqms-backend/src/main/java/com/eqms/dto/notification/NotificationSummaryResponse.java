package com.eqms.dto.notification;

import java.util.Map;

public record NotificationSummaryResponse(
        long total,
        long unread,
        long personal,
        long system,
        Map<String, Long> byType,
        /** How many notifications of the person there are at each priority (low, medium, high, critical), read ones included. */
        Map<String, Long> byPriority
) {
}
