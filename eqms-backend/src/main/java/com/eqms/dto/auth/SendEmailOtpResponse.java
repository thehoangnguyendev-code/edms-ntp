package com.eqms.dto.auth;

public record SendEmailOtpResponse(
        long expiresIn,
        long cooldownSeconds
) {
}
