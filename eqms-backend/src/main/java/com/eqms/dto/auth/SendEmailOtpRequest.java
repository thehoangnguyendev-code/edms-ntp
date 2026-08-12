package com.eqms.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record SendEmailOtpRequest(
        @NotBlank String mfaToken
) {
}
