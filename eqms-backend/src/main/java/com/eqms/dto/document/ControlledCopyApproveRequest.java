package com.eqms.dto.document;

public record ControlledCopyApproveRequest(
        String username,
        String password,
        String signatureToken
) {
}
