package com.eqms.dto.auth;

public record MfaVerificationOutcome(
        AuthResponse authResponse,
        String trustedDeviceToken
) {
}
