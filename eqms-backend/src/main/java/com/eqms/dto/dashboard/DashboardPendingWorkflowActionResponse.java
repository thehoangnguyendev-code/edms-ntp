package com.eqms.dto.dashboard;

import java.time.Instant;
import java.util.UUID;

/**
 * A document workflow action assigned to the currently authenticated user.
 * This is a Dashboard projection, not a Work Management task.
 */
public record DashboardPendingWorkflowActionResponse(
        UUID revisionId,
        UUID documentId,
        String documentNumber,
        String documentName,
        String revisionNumber,
        String status,
        String taskType,
        Instant createdAt
) {
}
