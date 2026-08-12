package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record VerifyMfaRequest(
        @NotBlank String mfaToken,
        @NotBlank String otp,
        @NotBlank String method,
        Boolean rememberDevice
) {
}
