package com.eqms.dto.dashboard;

public record DashboardSummaryResponse(
        long totalEffectiveDocuments,
        long pendingReview,
        long pendingApproval,
        long pendingTraining,
        long myPendingTasks,
        long totalDocuments
) {
}
