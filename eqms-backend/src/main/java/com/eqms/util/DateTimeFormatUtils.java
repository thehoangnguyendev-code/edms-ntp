package com.eqms.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.Temporal;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The one place that turns a date or a time into text a person reads: a date is {@code dd/MM/yyyy}, a date with a time is {@code dd/MM/yyyy HH:mm:ss} (24 hours),
 * in the time zone of the site. Everything shown to a person, printed on a document, sent in an e-mail or written in an audit text uses it; ISO-8601 is only for what machines
 * exchange (the JSON of the API, the database, file names). {@code DateFormatGuardTest} fails the build when other code builds its own display pattern.
 */
public final class DateTimeFormatUtils {

    /** The pattern of a date shown to a person. */
    public static final String DATE_PATTERN = "dd/MM/yyyy";
    /** The pattern of a date and time shown to a person. */
    public static final String DATETIME_PATTERN = "dd/MM/yyyy HH:mm:ss";
    /** The same pattern for the signature catalog, which spells the year as {@code uuuu}. */
    public static final String DATETIME_PATTERN_STRICT = "dd/MM/uuuu HH:mm:ss";
    /** The code of the display format as the settings and the screens name it. It is the only one: it is not a choice of the system or of a user. */
    public static final String DISPLAY_FORMAT_CODE = "DD/MM/YYYY HH:mm:ss";
    /** The time zone of the site: the display zone of every date and time of the system. */
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** The id of that zone, as the settings and the signature records name it. */
    public static final String ZONE_ID = "Asia/Ho_Chi_Minh";

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern(DATE_PATTERN, Locale.ROOT);
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern(DATETIME_PATTERN, Locale.ROOT);
    private static final Pattern ISO_DATE = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");
    private static final Pattern ISO_DATETIME = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?(Z|[+-]\\d{2}(?::?\\d{2})?)?(\\[.*])?$");

    private DateTimeFormatUtils() {
    }

    public static String formatDate(LocalDate value) {
        return value == null ? null : DATE_FORMAT.format(value);
    }

    public static String formatDateTime(Instant value) {
        return value == null ? null : DATETIME_FORMAT.format(value.atZone(ZONE));
    }

    /** A date with no time: a date column, a {@code LocalDate}, or the day of a moment in the zone of the site. */
    public static String formatDate(Object value) {
        Temporal temporal = toTemporal(value);
        if (temporal == null) return null;
        return temporal instanceof LocalDate date ? DATE_FORMAT.format(date) : DATE_FORMAT.format(inSiteZone(temporal));
    }

    /** A moment: date and time in the zone of the site. A date with no time is shown as a date. */
    public static String formatDateTime(Object value) {
        Temporal temporal = toTemporal(value);
        if (temporal == null) return null;
        return temporal instanceof LocalDate date ? DATE_FORMAT.format(date) : DATETIME_FORMAT.format(inSiteZone(temporal));
    }

    /**
     * Text for a person from whatever the code holds: a date or moment becomes {@code dd/MM/yyyy} or {@code dd/MM/yyyy HH:mm:ss}; a text that is an ISO date or
     * date-time (a value read from a database row or built with {@code toString()}) is converted the same way; anything else is returned as it is. Never returns null.
     */
    public static String display(Object value) {
        if (value == null) return "";
        if (value instanceof CharSequence text) return displayText(text.toString());
        String formatted = formatDateTime(value);
        return formatted != null ? formatted : String.valueOf(value);
    }

    /** A month (a date of that month, or its text) as {@code MM/yyyy}: the planned month of a training requirement. */
    public static String displayMonth(Object value) {
        if (value == null) return "";
        LocalDate date = null;
        if (value instanceof CharSequence text && text.length() >= 7) {
            try {
                date = LocalDate.parse(text.toString().substring(0, 7) + "-01");
            } catch (Exception notADate) {
                return text.toString();
            }
        } else {
            Temporal temporal = toTemporal(value);
            if (temporal instanceof LocalDate localDate) date = localDate;
            else if (temporal != null) date = inSiteZone(temporal).toLocalDate();
        }
        return date == null ? String.valueOf(value) : String.format("%02d/%d", date.getMonthValue(), date.getYear());
    }

    /** An ISO date or date-time inside a text is shown in the display format; other text is unchanged. */
    public static String displayText(String text) {
        if (text == null) return "";
        String trimmed = text.trim();
        if (ISO_DATE.matcher(trimmed).matches()) return DATE_FORMAT.format(LocalDate.parse(trimmed));
        if (ISO_DATETIME.matcher(trimmed).matches()) {
            Temporal parsed = parseIsoDateTime(trimmed);
            if (parsed != null) return DATETIME_FORMAT.format(inSiteZone(parsed));
        }
        return text;
    }

    private static final Pattern ISO_IN_TEXT = Pattern.compile(
            "(?<![\\d\\-/.:])(\\d{4}-\\d{2}-\\d{2})(?:[T ](\\d{2}:\\d{2}(?::\\d{2})?)(?:\\.\\d+)?(Z|[+-]\\d{2}(?::?\\d{2})?)?)?(?![\\d\\-/])");

    /**
     * A free text shown to a person (an audit comment, a notification, an e-mail) with every ISO date or date-time inside it written in the display format: a text built from a
     * database value or from {@code toString()} never reaches a person as {@code 2026-10-23} or {@code 2026-10-23T07:00:00Z}. Text without such a value is returned as it is.
     */
    public static String normalizeText(String text) {
        if (text == null || text.length() < 10) return text;
        java.util.regex.Matcher matcher = ISO_IN_TEXT.matcher(text);
        StringBuilder out = new StringBuilder();
        int last = 0;
        while (matcher.find()) {
            String replacement;
            try {
                if (matcher.group(2) == null) {
                    replacement = DATE_FORMAT.format(LocalDate.parse(matcher.group(1)));
                } else {
                    String iso = matcher.group(0).replace(' ', 'T');
                    Temporal parsed = parseIsoDateTime(iso);
                    replacement = parsed == null ? matcher.group(0) : DATETIME_FORMAT.format(inSiteZone(parsed));
                }
            } catch (Exception notADate) {
                replacement = matcher.group(0);
            }
            out.append(text, last, matcher.start()).append(replacement);
            last = matcher.end();
        }
        return last == 0 ? text : out.append(text, last, text.length()).toString();
    }

    private static Temporal parseIsoDateTime(String text) {
        String normalized = text.replaceFirst("\\[.*]$", "");
        normalized = normalized.replaceFirst("^(\\d{4}-\\d{2}-\\d{2}) ", "$1T");
        // an offset written +07 or +0700 is read as +07:00
        normalized = normalized.replaceFirst("([+-]\\d{2})$", "$1:00").replaceFirst("([+-]\\d{2})(\\d{2})$", "$1:$2");
        try {
            return OffsetDateTime.parse(normalized);
        } catch (Exception ignored) {
            // no offset: the time is taken in the zone of the site
        }
        try {
            return LocalDateTime.parse(normalized.replace(' ', 'T')).atZone(ZONE);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static Temporal toTemporal(Object value) {
        if (value == null) return null;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        if (value instanceof Date date) return date.toInstant();
        if (value instanceof Instant || value instanceof LocalDate || value instanceof LocalDateTime
                || value instanceof OffsetDateTime || value instanceof ZonedDateTime) return (Temporal) value;
        return null;
    }

    /** A moment has a zone and is shown in the zone of the site; a date and time without a zone is taken as the time of the site. */
    private static ZonedDateTime inSiteZone(Temporal temporal) {
        if (temporal instanceof Instant instant) return instant.atZone(ZONE);
        if (temporal instanceof OffsetDateTime offset) return offset.atZoneSameInstant(ZONE);
        if (temporal instanceof ZonedDateTime zoned) return zoned.withZoneSameInstant(ZONE);
        if (temporal instanceof LocalDateTime local) return local.atZone(ZONE);
        return ((LocalDate) temporal).atStartOfDay(ZONE);
    }
}
