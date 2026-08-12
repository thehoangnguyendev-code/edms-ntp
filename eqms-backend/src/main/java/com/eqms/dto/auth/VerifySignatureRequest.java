package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record VerifySignatureRequest(
        String username,
        @NotBlank(message = "Password is required")
        String password
) {
}
