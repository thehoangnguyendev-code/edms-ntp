package com.eqms.dto.controlledcopyrecall;

import java.time.Instant;
import java.util.List;

public record RecallBatchResponse(
        String id,
        String batchNumber,
        String status,
        String createdByName,
        Instant createdAt,
        String committedByName,
        Instant committedAt,
        Instant receivedAt,
        String recallReason,
        int totalItems,
        int readyItems,
        int blockedItems,
        int unmatchedItems,
        int excludedItems,
        /** True when at least one scan will be recalled and every scan that is not excluded is ready. */
        boolean readyToCommit,
        List<RecallItemResponse> items
) {
}
