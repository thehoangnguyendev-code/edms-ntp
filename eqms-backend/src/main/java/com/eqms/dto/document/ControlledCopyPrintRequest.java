package com.eqms.dto.document;

public record ControlledCopyPrintRequest(
        String printedBy,
        String printedAt,
        String signatureToken
) {
}
