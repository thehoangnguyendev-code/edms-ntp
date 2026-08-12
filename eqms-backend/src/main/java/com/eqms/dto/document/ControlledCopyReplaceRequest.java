package com.eqms.dto.document;

public record ControlledCopyReplaceRequest(
        String reason,
        String signatureToken
) {}
