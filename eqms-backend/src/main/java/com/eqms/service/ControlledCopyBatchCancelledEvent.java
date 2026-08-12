package com.eqms.service;

import java.util.List;
import java.util.UUID;

/**
 * Published after a Cancel Batch transaction commits (batch status/audit already saved), so
 * per-copy cancel (status flip + individual audit log) can run asynchronously with progress
 * reported over SSE, instead of blocking the HTTP response or letting one ineligible copy
 * (Distributed) abort the rest of the batch.
 */
public record ControlledCopyBatchCancelledEvent(
        UUID batchId,
        UUID jobId,
        List<UUID> copyIds,
        UUID issuerUserId,
        String cancellationReason
) {}
