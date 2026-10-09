package com.eqms.dto.announcement;

import java.time.Instant;
import java.util.UUID;

/** What a signed-in user is shown: only the content and the window, nothing about who created it. */
public record ActiveAnnouncementResponse(
        UUID id,
        String title,
        String message,
        String severity,
        Instant startsAt,
        Instant endsAt
) {
}
