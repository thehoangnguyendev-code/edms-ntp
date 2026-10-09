package com.eqms.dto.announcement;

import java.time.Instant;

/**
 * An announcement as the administrator submits it. {@code version} is the value the form was loaded with (null on create),
 * so an edit of an announcement someone else has changed in the meantime is refused instead of overwriting.
 */
public record AnnouncementRequest(
        String title,
        String message,
        String severity,
        Instant startsAt,
        Instant endsAt,
        Boolean enabled,
        Long version
) {
}
