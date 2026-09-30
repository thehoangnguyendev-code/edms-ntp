package com.eqms.service;

import java.util.UUID;

/**
 * Published after an Uncontrolled Copy Distribute transaction commits (status already DISTRIBUTED),
 * so the recipient e-mail (PDF attached + login-required download link) is sent asynchronously with
 * progress over SSE -- mirrors {@link ControlledCopyBatchDistributedEvent}.
 */
public record UncontrolledCopyDistributedEvent(UUID uncontrolledCopyId, UUID jobId, UUID issuerUserId) {}
