package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;

public record StatusActionRequest(
        @NotBlank String reason,
        String date,
        @NotBlank String signatureToken
) {
}
