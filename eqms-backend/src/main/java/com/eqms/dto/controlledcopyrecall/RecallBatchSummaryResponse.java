package com.eqms.dto.controlledcopyrecall;

import java.time.Instant;

/** A draft recall batch the current user can resume. */
public record RecallBatchSummaryResponse(
        String id,
        String batchNumber,
        String status,
        Instant createdAt,
        int totalItems
) {
}
