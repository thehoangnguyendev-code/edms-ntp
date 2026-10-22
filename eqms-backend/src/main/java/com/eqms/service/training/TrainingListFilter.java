package com.eqms.service.training;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The where clause of a Training list, built from the filters of the screen. Every value travels as a parameter and every column is a fixed expression written
 * by the service, never taken from the request. A blank filter adds nothing; a malformed date is refused with {@code TRAINING_DATE_INVALID} instead of being ignored.
 */
final class TrainingListFilter {
    private final StringBuilder where = new StringBuilder(" where 1=1");
    private final List<Object> args = new ArrayList<>();

    /** Adds a fixed condition with its parameters, for what the generic helpers do not cover (scope by department, a search over several columns). */
    TrainingListFilter raw(String condition, Object... values) {
        where.append(" and ").append(condition);
        for (Object value : values) args.add(value);
        return this;
    }

    TrainingListFilter equal(String column, Object value) {
        if (value == null || (value instanceof String text && text.isBlank())) return this;
        where.append(" and ").append(column).append(" = ?");
        args.add(value instanceof String text ? text.trim() : value);
        return this;
    }

    /** Case-insensitive "contains" over one or several columns. */
    TrainingListFilter contains(String text, String... columns) {
        if (text == null || text.isBlank() || columns.length == 0) return this;
        String like = "%" + text.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        List<String> parts = new ArrayList<>();
        for (String column : columns) {
            parts.add("lower(coalesce(" + column + "::text,'')) like ? escape '\\'");
            args.add(like);
        }
        where.append(" and (").append(String.join(" or ", parts)).append(")");
        return this;
    }

    /** A date column (type date) from and up to the given days, both included. */
    TrainingListFilter dateRange(String column, String from, String to) {
        LocalDate start = date(from), end = date(to);
        if (start != null) { where.append(" and ").append(column).append(" >= ?"); args.add(Date.valueOf(start)); }
        if (end != null) { where.append(" and ").append(column).append(" <= ?"); args.add(Date.valueOf(end)); }
        return this;
    }

    /** A time column (timestamp) from the start of the first day up to the end of the last day, both days included, in the site's time zone. */
    TrainingListFilter timeRange(String column, String from, String to) {
        LocalDate start = date(from), end = date(to);
        if (start != null) { where.append(" and ").append(column).append(" >= ?"); args.add(Timestamp.from(start.atStartOfDay(TrainingNumberService.ZONE).toInstant())); }
        if (end != null) { where.append(" and ").append(column).append(" < ?"); args.add(Timestamp.from(end.plusDays(1).atStartOfDay(TrainingNumberService.ZONE).toInstant())); }
        return this;
    }

    String where() {
        return where.toString();
    }

    /** Only the conditions (each starting with " and "), to be appended to a where clause the service has already begun. */
    String and() {
        return where.substring(" where 1=1".length());
    }

    /** The parameters so far; a copy, so the caller may add its paging parameters. */
    List<Object> args() {
        return new ArrayList<>(args);
    }

    static LocalDate date(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("TRAINING_DATE_INVALID");
        }
    }
}
