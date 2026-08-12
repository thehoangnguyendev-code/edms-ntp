package com.eqms.dto.document;

/**
 * Response DTO containing the count of revisions pending action by the current user.
 */
public record PendingCountsResponse(
        long pendingReview,
        long pendingApproval
) {
}
