package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/** Signed amendment to an active time-limited access grant. */
public record UpdateTimeLimitedUserGrantRequest(
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        boolean notifyEmailOnExpiry,
        String reason,
        @NotBlank String signatureToken
) {
}
