package com.eqms.dto.auth;

public record SetupMfaResponse(
        String secret,
        String qrCodeUrl,
        String method
) {
}
