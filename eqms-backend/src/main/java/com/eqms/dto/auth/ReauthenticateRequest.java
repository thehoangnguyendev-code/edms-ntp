package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record ReauthenticateRequest(
        @NotBlank String password
) {
}
