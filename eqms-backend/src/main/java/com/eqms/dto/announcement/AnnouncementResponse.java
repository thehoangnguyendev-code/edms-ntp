package com.eqms.dto.announcement;

import java.time.Instant;
import java.util.UUID;

/** An announcement in the administration screens. {@code state} is ACTIVE, SCHEDULED, EXPIRED or DISABLED. */
public record AnnouncementResponse(
        UUID id,
        String title,
        String message,
        String severity,
        Instant startsAt,
        Instant endsAt,
        boolean enabled,
        String state,
        long version,
        String createdBy,
        String updatedBy,
        Instant createdAt,
        Instant updatedAt
) {
}
