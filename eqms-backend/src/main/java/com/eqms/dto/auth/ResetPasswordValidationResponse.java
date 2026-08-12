package com.eqms.dto.auth;

public record ResetPasswordValidationResponse(
        boolean valid,
        String expiresAt
) {
}
