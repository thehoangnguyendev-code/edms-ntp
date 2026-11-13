package com.eqms.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Display-time cleanup for Audit Trail text. Identifiers (UUIDs) are for the server and the database only and must never reach a
 * user. Stored audit rows are immutable and are never rewritten; older rows that carry a raw id inside their text are cleaned here
 * when they are returned.
 *
 * "Name (uuid)" becomes "Name"; "Label uuid" becomes "Label"; a value that is only an id (or follows "Label: ") becomes a dash.
 */
public final class AuditDisplayText {

    private static final String UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    private static final Pattern BRACKETED = Pattern.compile("\\s*[(\\[]\\s*" + UUID + "\\s*[)\\]]");
    private static final Pattern BARE = Pattern.compile(UUID);

    private AuditDisplayText() {
    }

    public static String hideIds(String text) {
        if (text == null || text.length() < 36) {
            return text;
        }
        String result = BRACKETED.matcher(text).replaceAll("");
        Matcher m = BARE.matcher(result);
        StringBuilder out = new StringBuilder();
        int last = 0;
        while (m.find()) {
            String before = result.substring(last, m.start());
            String trimmed = before.stripTrailing();
            boolean standsAlone = trimmed.isEmpty() || trimmed.endsWith(":") || trimmed.endsWith("=") || trimmed.endsWith("->")
                    || trimmed.endsWith("→") || trimmed.endsWith(",") || trimmed.endsWith("|");
            if (standsAlone) {
                out.append(before).append("—");
            } else {
                out.append(trimmed);
            }
            last = m.end();
        }
        out.append(result.substring(last));
        return out.toString();
    }
}
