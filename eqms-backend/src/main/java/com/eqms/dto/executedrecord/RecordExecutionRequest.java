package com.eqms.dto.executedrecord;

/** Paper scan request, authorized and signed on the server. */
public record RecordExecutionRequest(
        String sourceControlledCopyId,
        String filledByUserId,
        String filledAt,
        String reason,
        String signatureToken
) {
}
