package com.eqms.service.training;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Turns database rows into what the API returns: camelCase names, dates as ISO text (the screens never see a column name or a database type). */
public final class TrainingRows {
    private TrainingRows() {}

    /**
     * The ORDER BY of a list that the person sorts by a column header. Only a key the service lists is turned into SQL (the screen never sends a column name); an unknown or missing key
     * gives the default order. The default order also breaks ties, so the pages never repeat or skip a row.
     */
    public static String orderBy(String sortBy, String direction, Map<String, String> allowed, String fallback) {
        String column = sortBy == null ? null : allowed.get(sortBy);
        if (column == null) return " order by " + fallback;
        return " order by " + column + " " + ("desc".equalsIgnoreCase(direction) ? "desc" : "asc") + " nulls last, " + fallback;
    }

    public static Map<String, Object> camel(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((key, value) -> out.put(camelKey(key), plain(value)));
        return out;
    }

    public static List<Map<String, Object>> camel(List<Map<String, Object>> rows) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) out.add(camel(row));
        return out;
    }

    private static Object plain(Object value) {
        if (value instanceof Date date) return date.toLocalDate().toString();
        if (value instanceof Timestamp timestamp) return timestamp.toInstant().toString();
        if (value instanceof java.time.OffsetDateTime time) return time.toInstant().toString();
        return value;
    }

    private static String camelKey(String key) {
        if (key.indexOf('_') < 0) return key;
        StringBuilder out = new StringBuilder();
        boolean up = false;
        for (char c : key.toCharArray()) {
            if (c == '_') { up = true; continue; }
            out.append(up ? Character.toUpperCase(c) : c);
            up = false;
        }
        return out.toString();
    }
}
