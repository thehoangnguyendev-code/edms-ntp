package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * What the Report Types that report on documents share (REPORT-DOCUMENT-SOURCES-2026-11-12): how the data scope of a template becomes SQL, how a filter value is read and
 * how a date range is checked. Every value reaches the SQL as a parameter; nothing a person types is part of the SQL text.
 */
final class ReportQueryKit {
    /** The widest range of one date filter, in days. */
    static final int MAX_RANGE_DAYS = 366;

    private ReportQueryKit() {}

    /**
     * The condition of the data scopes a template gives. SYSTEM sees all; BUSINESS_UNIT and DEPARTMENT see what belongs to the unit or department of the person (never one
     * named in the request); PERSONAL sees what the person took part in. A scope the person has no unit or department for adds nothing, and no scope at all is refused.
     */
    static String grants(UserAccount actor, List<String> scopes, String businessUnitColumn, String departmentColumn, String personalCondition,
                         Supplier<List<Object>> personalArguments, List<Object> args) {
        List<String> grants = new ArrayList<>();
        for (String scope : scopes) {
            switch (scope) {
                case "SYSTEM" -> grants.add("true");
                case "BUSINESS_UNIT" -> {
                    if (actor.getBusinessUnit() != null && !actor.getBusinessUnit().isBlank()) {
                        grants.add(businessUnitColumn + "=?");
                        args.add(actor.getBusinessUnit());
                    }
                }
                case "DEPARTMENT" -> {
                    if (actor.getDepartment() != null && !actor.getDepartment().isBlank()) {
                        grants.add(departmentColumn + "=?");
                        args.add(actor.getDepartment());
                    }
                }
                case "PERSONAL" -> {
                    grants.add(personalCondition);
                    args.addAll(personalArguments.get());
                }
                default -> throw new SecurityException("REPORT_SCOPE_DENIED");
            }
        }
        if (grants.isEmpty()) throw new SecurityException("REPORT_SCOPE_DENIED");
        return String.join(" or ", grants);
    }

    /** A SQL condition with its parameters. */
    record Cond(String sql, List<Object> args) {}

    static final Cond EVERYTHING = new Cond("true", List.of());

    /** Adds a condition with AND; the arguments follow the ones already added, in the order of the placeholders. */
    static void and(StringBuilder sql, List<Object> args, Cond condition) {
        if (condition == EVERYTHING) {
            return;
        }
        sql.append(" and ").append(condition.sql());
        args.addAll(condition.args());
    }

    /**
     * The department of the person, compared as the Training module does (trimmed, without regard to case) with each of the columns. A person with no department matches
     * nothing. Used by the Training Report Types, whose own rule is "your department, unless you may see all departments".
     */
    static Cond ownDepartment(UserAccount actor, String... columns) {
        String own = actor.getDepartment() == null ? "" : actor.getDepartment();
        if (own.isBlank()) return new Cond("false", List.of());
        List<Object> args = new ArrayList<>();
        List<String> parts = new ArrayList<>();
        for (String column : columns) {
            parts.add("lower(trim(" + column + "))=lower(trim(?))");
            args.add(own);
        }
        return new Cond("(" + String.join(" or ", parts) + ")", args);
    }

    /**
     * Like {@link #grants} for a type that has no business-unit scope and decides for itself what the system and department scopes mean: the caller gives the condition of each.
     * A business-unit scope is refused.
     */
    static String grantsOf(UserAccount actor, List<String> scopes, Cond system, Cond department, Cond personal, List<Object> args) {
        List<String> grants = new ArrayList<>();
        for (String scope : scopes) {
            Cond chosen = switch (scope) {
                case "SYSTEM" -> system;
                case "DEPARTMENT" -> actor.getDepartment() == null || actor.getDepartment().isBlank() ? null : department;
                case "PERSONAL" -> personal;
                default -> throw new SecurityException("REPORT_SCOPE_DENIED");
            };
            if (chosen != null) {
                grants.add(chosen.sql());
                args.addAll(chosen.args());
            }
        }
        if (grants.isEmpty()) throw new SecurityException("REPORT_SCOPE_DENIED");
        return String.join(" or ", grants);
    }

    /** SQL that turns a code column into its label ({@code case col when 'A' then 'a Label' ... else col end}); pairs are code, label, code, label. */
    static String labelCase(String column, String... codeAndLabel) {
        StringBuilder sql = new StringBuilder("case ").append(column);
        for (int i = 0; i + 1 < codeAndLabel.length; i += 2) sql.append(" when '").append(codeAndLabel[i]).append("' then '").append(codeAndLabel[i + 1]).append("'");
        return sql.append(" else ").append(column).append(" end").toString();
    }

    /** A type that is not divided by department or business unit is shown only under the whole-system scope. */
    static void requireSystemScope(List<String> scopes) {
        if (scopes == null || !scopes.contains("SYSTEM")) throw new SecurityException("REPORT_SCOPE_DENIED");
    }

    /**
     * A run of a log-like type names its range: both dates (prefix + From, prefix + To), in order, and no wider than {@code maxDays} days. The messages are the ones of the Audit
     * Trail type, so the screens say the same thing.
     */
    static void requireRange(Map<String, Object> filters, String prefix, int maxDays) {
        LocalDate from = date(filters.get(prefix + "From"));
        LocalDate to = date(filters.get(prefix + "To"));
        if (from == null || to == null) throw new IllegalArgumentException("REPORT_AUDIT_RANGE_REQUIRED");
        if (to.isBefore(from)) throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID");
        if (ChronoUnit.DAYS.between(from, to) + 1 > maxDays) throw new IllegalArgumentException("REPORT_AUDIT_RANGE_TOO_WIDE");
    }

    /** A range of moments: the whole of the last day is included (a record at 23:59 on the "to" date is in the range). */
    static void momentRange(StringBuilder sql, List<Object> args, Map<String, Object> filters, String prefix, String column) {
        LocalDate from = date(filters.get(prefix + "From"));
        LocalDate to = date(filters.get(prefix + "To"));
        if (from != null && to != null && to.isBefore(from)) throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID");
        if (from != null) { sql.append(" and ").append(column).append(">=?"); args.add(java.sql.Timestamp.valueOf(from.atStartOfDay())); }
        if (to != null) { sql.append(" and ").append(column).append("<?"); args.add(java.sql.Timestamp.valueOf(to.plusDays(1).atStartOfDay())); }
    }

    /** Refuses a filter the type does not have, and a value that is not text. */
    static void checkFilters(Map<String, Object> filters, Set<String> permitted) {
        if (!permitted.containsAll(filters.keySet())) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        if (filters.values().stream().anyMatch(value -> value != null && !(value instanceof String))) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
    }

    /** A moment as text to the second (2026-09-21 15:57:39), in the time zone of the session; a report shows no fraction of a second. */
    static String timestamp(String column) { return "to_char(" + column + ", 'YYYY-MM-DD HH24:MI:SS')"; }

    /** "from" and "to" of one date filter (prefix + From, prefix + To), in order and within {@link #MAX_RANGE_DAYS} days. */
    static void dates(StringBuilder sql, List<Object> args, Map<String, Object> filters, String prefix, String column) {
        LocalDate from = date(filters.get(prefix + "From"));
        LocalDate to = date(filters.get(prefix + "To"));
        if (from != null && to != null && to.isBefore(from)) throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID");
        if (from != null && to != null && ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) throw new IllegalArgumentException("REPORT_DATE_RANGE_TOO_LARGE");
        if (from != null) { sql.append(" and ").append(column).append(">=?"); args.add(java.sql.Date.valueOf(from)); }
        if (to != null) { sql.append(" and ").append(column).append("<=?"); args.add(java.sql.Date.valueOf(to)); }
    }

    /** A filter that names one value of a list (a status, a department): at most 100 characters, compared as text. */
    static void equalsFilters(StringBuilder sql, List<Object> args, Map<String, Object> filters, Map<String, String> columnByFilter) {
        for (var entry : columnByFilter.entrySet()) {
            String value = text(filters.get(entry.getKey()));
            if (value.length() > 100) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
            if (!value.isBlank()) {
                sql.append(" and cast(").append(entry.getValue()).append(" as text)=?");
                args.add(value);
            }
        }
    }

    /** The search term as a LIKE pattern with its own wildcards escaped; the caller adds "escape '\\'" to the condition. */
    static String likeTerm(String search) {
        if (search.length() > 200) throw new IllegalArgumentException("REPORT_SEARCH_TOO_LONG");
        return "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    static LocalDate date(Object value) {
        String text = text(value);
        try { return text.isBlank() ? null : LocalDate.parse(text); }
        catch (RuntimeException invalid) { throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID"); }
    }

    static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
}
