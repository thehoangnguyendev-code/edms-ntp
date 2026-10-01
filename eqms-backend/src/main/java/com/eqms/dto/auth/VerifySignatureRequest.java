package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record VerifySignatureRequest(
        @NotBlank(message = "Username is required")
        String username,
        @NotBlank(message = "Password is required")
        String password
) {
}
