package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

public record CancelTimeLimitedUserGrantRequest(
        @NotBlank String reason,
        @NotBlank String signatureToken
) {
}
