package com.eqms.dto.dashboard;

import java.time.Instant;
import java.util.UUID;

public record DashboardRecentActivityResponse(
        UUID id,
        String entityType,
        String entityName,
        String entityCode,
        String action,
        String actionType,
        String userFullName,
        String fromStatus,
        String toStatus,
        Instant eventTime
) {
}
