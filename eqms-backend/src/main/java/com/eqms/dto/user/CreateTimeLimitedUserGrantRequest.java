package com.eqms.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** One or many users selected at once -- the service creates one grant row per userId, never
 *  merged, so the list screen always shows the correct record count. startAt/endAt carry a
 *  time-of-day, not just a date -- an admin may need the window to start/end mid-day. */
public record CreateTimeLimitedUserGrantRequest(
        @NotEmpty List<UUID> userIds,
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        boolean notifyEmailOnExpiry,
        String reason,
        @NotBlank String signatureToken
) {
}
