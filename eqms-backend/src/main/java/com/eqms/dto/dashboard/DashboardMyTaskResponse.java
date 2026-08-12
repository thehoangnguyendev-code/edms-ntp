package com.eqms.dto.dashboard;

import java.time.Instant;
import java.util.UUID;

public record DashboardMyTaskResponse(
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
