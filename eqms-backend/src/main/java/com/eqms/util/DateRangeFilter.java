package com.eqms.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Shared inclusive calendar-day filtering for security catalogue lists. */
public final class DateRangeFilter {
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private DateRangeFilter() { }

    /** The day a dd/MM/yyyy text names, or null when it is empty or not a real date (31/02/2026): a list then simply does not filter by it. */
    public static LocalDate dayOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            LocalDate day = LocalDate.parse(value.trim(), FORMAT);
            // the lenient parser moves 31/02 to 28/02: only a text that names the day it stands for is a date
            return day.format(FORMAT).equals(value.trim()) ? day : null;
        } catch (RuntimeException ignored) { return null; }
    }

    public static boolean matches(Instant value, String from, String to) {
        if ((from == null || from.isBlank()) && (to == null || to.isBlank())) return true;
        if (value == null) return false;
        Instant start = startOfDay(from);
        Instant endExclusive = startOfNextDay(to);
        return (start == null || !value.isBefore(start))
                && (endExclusive == null || value.isBefore(endExclusive));
    }

    private static Instant startOfDay(String value) {
        LocalDate day = parse(value);
        return day == null ? null : day.atStartOfDay(DateTimeFormatUtils.ZONE).toInstant();
    }

    private static Instant startOfNextDay(String value) {
        LocalDate day = parse(value);
        return day == null ? null : day.plusDays(1).atStartOfDay(DateTimeFormatUtils.ZONE).toInstant();
    }

    private static LocalDate parse(String value) {
        if (value == null || value.isBlank()) return null;
        try { return LocalDate.parse(value.trim(), FORMAT); }
        catch (RuntimeException ignored) { throw new IllegalArgumentException("Invalid date. Use dd/MM/yyyy."); }
    }
}
