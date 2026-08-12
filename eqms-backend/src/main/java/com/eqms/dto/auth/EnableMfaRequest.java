package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record EnableMfaRequest(
        @NotBlank String otp,
        String method
) {
}
