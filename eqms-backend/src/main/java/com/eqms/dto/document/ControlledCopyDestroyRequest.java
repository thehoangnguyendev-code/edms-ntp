package com.eqms.dto.document;

public record ControlledCopyDestroyRequest(
        String destroyedBy,
        String destroyedByUserId,
        String destroyReason,
        String witnessedBy,
        String witnessedByUserId,
        String destroyedAt,
        String destructionMethod,
        String destructionType,
        String signatureToken
) {
}
