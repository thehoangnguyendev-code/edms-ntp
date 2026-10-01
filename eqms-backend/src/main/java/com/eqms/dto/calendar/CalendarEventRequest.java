package com.eqms.dto.calendar;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

/** All-day end is an inclusive date; timed end is exclusive. Owner is never accepted from the client. */
public record CalendarEventRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 4000) String description,
        @NotNull LocalDateTime start,
        @NotNull LocalDateTime end,
        boolean allDay,
        @PositiveOrZero Long version
) { }
