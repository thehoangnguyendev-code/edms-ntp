package com.eqms.service;

import java.util.List;
import java.util.UUID;

/**
 * Published after a Distribute Batch transaction commits (status/expiry already saved),
 * so per-copy PDF re-render + notification email can run asynchronously with progress
 * reported over SSE, instead of blocking the HTTP response.
 */
public record ControlledCopyBatchDistributedEvent(UUID batchId, UUID jobId, List<UUID> copyIds, UUID issuerUserId) {}
