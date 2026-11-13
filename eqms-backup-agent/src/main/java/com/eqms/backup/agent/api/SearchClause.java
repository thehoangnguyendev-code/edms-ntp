package com.eqms.backup.agent.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The text search of a list: "does any column the screen shows contain what was typed". Every list builds it the same way, so a person,
 * a status, a date as it is written on screen, all find the row. The backend sends the user names behind a name typed in the box as
 * "people", because this side keeps user names while the screens show full names.
 */
public final class SearchClause {

    private static final String ZONE = System.getenv().getOrDefault("AGENT_ZONE", "Asia/Ho_Chi_Minh");

    private final String like;
    private final List<String> parts = new ArrayList<>();
    private final List<Object> args = new ArrayList<>();

    public SearchClause(String text) {
        this.like = "%" + text.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** A column or expression that is compared as lower-case text, for example {@code lower(r.reason)}. */
    public SearchClause text(String expression) {
        parts.add(expression + " like ?");
        args.add(like);
        return this;
    }

    /** What the screen writes for a stored code, for example 'waiting to finalize' for PENDING_FINALIZATION, when the row's condition holds. */
    public SearchClause label(String condition, String label) {
        parts.add("(" + condition + " and '" + label.replace("'", "''") + "' like ?)");
        args.add(like);
        return this;
    }

    /** A timestamp as the screen writes it: dd/MM/yyyy HH:mm:ss in the agent's zone. */
    public SearchClause date(String column) {
        parts.add("to_char(" + column + " at time zone ?, 'DD/MM/YYYY HH24:MI:SS') like ?");
        args.add(ZONE);
        args.add(like);
        return this;
    }

    /** A version or number matched exactly. */
    public SearchClause exact(String expression, String value) {
        parts.add(expression + " = ?");
        args.add(value.trim());
        return this;
    }

    /** The people whose full name contains the text, as the user names kept in these columns. */
    public SearchClause people(List<String> people, String... columns) {
        if (people == null || people.isEmpty()) return this;
        String marks = String.join(",", java.util.Collections.nCopies(people.size(), "?"));
        for (String column : columns) {
            parts.add("lower(" + column + ") in (" + marks + ")");
            people.forEach(person -> args.add(person.toLowerCase(Locale.ROOT)));
        }
        return this;
    }

    /** {@code " and (a or b or …)"} added to the where clause with its arguments. */
    public void appendTo(StringBuilder where, List<Object> into) {
        where.append(" and (").append(String.join(" or ", parts)).append(")");
        into.addAll(args);
    }

    public static List<String> split(String people) {
        return people == null || people.isBlank() ? List.of() : java.util.Arrays.stream(people.split(",")).map(String::trim).filter(p -> !p.isEmpty()).toList();
    }
}
