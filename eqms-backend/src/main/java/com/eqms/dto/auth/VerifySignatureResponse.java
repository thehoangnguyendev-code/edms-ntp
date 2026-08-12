package com.eqms.dto.auth;

public record VerifySignatureResponse(
        boolean valid,
        String userId,
        String username,
        String fullName,
        String position,
        String department,
        String timestamp,
        String signatureToken
) {
}
