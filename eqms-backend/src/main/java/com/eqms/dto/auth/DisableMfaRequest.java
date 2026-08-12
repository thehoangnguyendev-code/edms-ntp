package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record DisableMfaRequest(
        @NotBlank String password
) {
}
