package com.eqms.util;

import java.util.Locale;
import java.util.Map;

/**
 * The tables of the system spell the same module in several ways (permissions: "report" and "reports", "settings" and "app-settings", "security" and "security-authorization"; workflows:
 * "DOCUMENT_CONTROL" and "documents"). A list of modules for a filter must show each module once, and a filter on one spelling must find the rows of the others. {@link #canonical} gives one key per
 * module; {@link #same} compares two keys by it. The names a person reads are made on the screen (utils/moduleDisplay.ts), from the menu. Keep the two lists alike.
 */
public final class ModuleKeys {
    private static final Map<String, String> CANONICAL_BY_COMPACT = Map.ofEntries(
            Map.entry("documents", "documents"), Map.entry("document", "documents"), Map.entry("documentcontrol", "documents"), Map.entry("doccontrol", "documents"),
            // a module is a level-1 menu: the sub-menus are found under the menu they are in
            Map.entry("controlledcopies", "documents"), Map.entry("controlledcopy", "documents"), Map.entry("uncontrolledcopies", "documents"),
            Map.entry("uncontrolledcopy", "documents"), Map.entry("documentreview", "documents"),
            Map.entry("accessreview", "security"), Map.entry("securityandaccess", "security"),
            Map.entry("knowledge", "self_service"), Map.entry("knowledgebase", "self_service"), Map.entry("dashboard", "self_service"),
            Map.entry("notifications", "notifications"), Map.entry("preferences", "preferences"), Map.entry("systeminformation", "system-information"),
            Map.entry("training", "training"), Map.entry("trainingmanagement", "training"),
            Map.entry("report", "reports"), Map.entry("reports", "reports"),
            Map.entry("audittrail", "audit-trail"),
            Map.entry("backup", "backup"), Map.entry("backuprestore", "backup"), Map.entry("backup&restore", "backup"),
            Map.entry("security", "security"), Map.entry("securityauthorization", "security"),
            Map.entry("settings", "settings"), Map.entry("appsettings", "settings"), Map.entry("applicationsettings", "settings"),
            Map.entry("systemadmin", "system-admin"), Map.entry("systemadministration", "system-admin"), Map.entry("system", "system-admin"),
            Map.entry("selfservice", "self_service"));

    private ModuleKeys() {}

    /**
     * The menu name of the module held by a column, as an SQL expression, so a report shows and filters by the name and never by the stored key.
     * A key that is not known stays as it is. The names and keys are fixed text of this application; the column is given by the calling code, never input.
     */
    public static String menuNameSql(String column) {
        Map<String, java.util.List<String>> byName = new java.util.TreeMap<>();
        CANONICAL_BY_COMPACT.forEach((spelling, key) -> byName.computeIfAbsent(DisplayLabels.module(key), name -> new java.util.ArrayList<>()).add("'" + spelling + "'"));
        StringBuilder sql = new StringBuilder("(case");
        byName.forEach((name, spellings) -> sql.append(" when regexp_replace(lower(").append(column).append("), '[[:space:]._-]+', '', 'g') in (")
                .append(spellings.stream().sorted().collect(java.util.stream.Collectors.joining(","))).append(") then '").append(name).append("'"));
        return sql.append(" else coalesce(").append(column).append(", '') end)").toString();
    }

    private static String compact(String key) {
        return key.toLowerCase(Locale.ROOT).replaceAll("[\\s._-]+", "");
    }

    /** Every spelling of a module without case, spaces, dots, dashes and underscores: what a column is compared with to find the rows of a module whatever the spelling in it. */
    public static java.util.List<String> compactSpellingsOf(String key) {
        String canonical = canonical(key);
        if (canonical == null || canonical.isEmpty()) return java.util.List.of();
        java.util.List<String> out = new java.util.ArrayList<>();
        out.add(compact(canonical));
        CANONICAL_BY_COMPACT.forEach((spelling, target) -> {
            if (target.equals(canonical) && !out.contains(spelling)) out.add(spelling);
        });
        return out;
    }

    /** One key for a module whatever its spelling; a key that is not known stays as it is (trimmed). */
    public static String canonical(String key) {
        if (key == null) return null;
        String trimmed = key.trim();
        if (trimmed.isEmpty()) return trimmed;
        return CANONICAL_BY_COMPACT.getOrDefault(compact(trimmed), trimmed);
    }

    /** True when both are the same module, whatever the spelling (empty and null are the same: no module). */
    public static boolean same(String a, String b) {
        String x = canonical(a) == null ? "" : canonical(a);
        String y = canonical(b) == null ? "" : canonical(b);
        return x.equalsIgnoreCase(y);
    }
}
