package com.eqms.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Published after a Recall Batch transaction commits (batch status/audit already saved), so
 * per-copy recall (status flip + individual audit log) can run asynchronously with progress
 * reported over SSE, instead of blocking the HTTP response or letting one bad copy abort the
 * rest of the batch.
 */
public record ControlledCopyBatchRecalledEvent(
        UUID batchId,
        UUID jobId,
        List<UUID> copyIds,
        UUID issuerUserId,
        String recallReason,
        Instant recalledAt
) {}
