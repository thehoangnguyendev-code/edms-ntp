package com.eqms.dto.document;

public record ControlledCopyCancelRequest(
        String reason,
        String signatureToken
) {
}
