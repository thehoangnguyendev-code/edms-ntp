package com.eqms.dto.notification;

import java.util.Map;

public record NotificationSummaryResponse(
        long total,
        long unread,
        long personal,
        long system,
        Map<String, Long> byType
) {
}
