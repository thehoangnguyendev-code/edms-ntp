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

    /** The columns that hold a machine value a screen shows as words; each gets its label beside it (status -> statusLabel) unless the row already has one. */
    private static final List<String> LABELLED = List.of("status", "state", "result", "kind", "method", "deliveryMode", "caseType");

    /** The label of a machine value is made once, on the server, so that no screen has to make a code readable (and none shows one). The value itself is not changed. */
    private static void addLabels(Map<String, Object> row) {
        for (String key : LABELLED) {
            Object value = row.get(key);
            if (value instanceof String code && com.eqms.util.DisplayLabels.isMachineValue(code) && !row.containsKey(key + "Label")) {
                row.put(key + "Label", com.eqms.util.DisplayLabels.status(code));
            }
        }
    }

    public static Map<String, Object> camel(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((key, value) -> out.put(camelKey(key), plain(value)));
        addLabels(out);
        if (out.get("documentNumber") != null && !out.containsKey("documentLabel")) {
            Object revision = out.containsKey("revisionNumber") ? out.get("revisionNumber") : out.get("documentRevision");
            out.put("documentLabel", documentLabel(out.get("documentNumber"), revision));
        }
        return out;
    }

    /** How a document and its revision are written on a training screen: "SOP.10405_0.0.1", or the number alone when the revision is not known. Null when there is no document. */
    public static String documentLabel(Object documentNumber, Object revisionNumber) {
        if (documentNumber == null || documentNumber.toString().isBlank()) return null;
        String number = documentNumber.toString().trim();
        if (revisionNumber == null || revisionNumber.toString().isBlank()) return number;
        return number + "_" + revisionNumber.toString().trim();
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
