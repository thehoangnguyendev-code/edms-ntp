package com.eqms.dto.controlledcopyrecall;

/**
 * Commits a reviewed batch with ONE electronic signature. {@code receivedAt} (an ISO instant or a date) is when the paper was
 * physically received; it defaults to now and cannot be in the future or before a copy was distributed.
 */
public record RecallBatchCommitRequest(
        String reason,
        String receivedAt,
        String signatureToken
) {
}
