package com.eqms.dto.dashboard;

import java.util.List;
import java.util.Map;

public record DashboardAdminStatsResponse(
        long totalUsers,
        long activeUsers,
        long inactiveUsers,
        long totalDocuments,
        Map<String, Long> documentsByStatus,
        Map<String, Long> revisionsByStatus,
        long auditEventsLast30Days,
        List<DashboardActivityPointResponse> auditActivityByDay
) {
}
