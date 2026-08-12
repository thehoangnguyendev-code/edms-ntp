package com.eqms.dto.document;

public record ControlledCopyRecallRequest(
        String recalledBy,
        String recallReason,
        String recallDate,
        String comment,
        String signatureToken
) {
}
