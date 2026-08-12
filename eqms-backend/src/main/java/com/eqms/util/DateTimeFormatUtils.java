package com.eqms.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class DateTimeFormatUtils {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private DateTimeFormatUtils() {
    }

    public static String formatDate(LocalDate value) {
        return value == null ? null : DATE_FORMAT.format(value);
    }

    public static String formatDateTime(Instant value) {
        return value == null ? null : DATETIME_FORMAT.format(value.atZone(ZONE));
    }
}
