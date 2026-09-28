package com.eqms.dto.user;

import java.time.Instant;
import java.util.UUID;

/** One row on the "Time-Limited User" admin screen -- one grant, one user, never merged even
 *  when several were created together from a single bulk "Create" submission. startAt/endAt
 *  carry a time-of-day, not just a date. */
public record TimeLimitedUserGrantResponse(
        UUID id,
        UUID userId,
        String employeeCode,
        String fullName,
        String username,
        String email,
        Instant startAt,
        Instant endAt,
        boolean notifyEmailOnExpiry,
        Instant notifiedAt,
        String reason,
        String status,
        /** Live window state derived at read time -- PENDING (before startDate), IN_WINDOW,
         *  EXPIRED, or CANCELLED -- independent of whether the scheduler has run yet tonight. */
        String windowState,
        String createdByName,
        Instant createdAt,
        String cancelledByName,
        Instant cancelledAt,
        String cancelReason
) {
}
