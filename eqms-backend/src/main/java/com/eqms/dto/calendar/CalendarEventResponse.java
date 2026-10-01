package com.eqms.dto.calendar;

import java.time.LocalDateTime;

public record CalendarEventResponse(String id, String source, String kind, String title, String description,
                                    LocalDateTime start, LocalDateTime end, boolean allDay,
                                    boolean editable, Long version, String actionUrl,
                                    String category, String taskStatus, String actionLabel) {
    public CalendarEventResponse(String id, String source, String kind, String title, String description,
                                 LocalDateTime start, LocalDateTime end, boolean allDay,
                                 boolean editable, Long version, String actionUrl) {
        this(id, source, kind, title, description, start, end, allDay, editable, version, actionUrl,
                "EQMS".equals(source) ? "MILESTONE" : source, null, "Open record");
    }
}
