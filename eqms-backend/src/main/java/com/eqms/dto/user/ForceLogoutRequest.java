package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

public record ForceLogoutRequest(
        @NotBlank String reason,
        @NotBlank String signatureToken
) {
}
