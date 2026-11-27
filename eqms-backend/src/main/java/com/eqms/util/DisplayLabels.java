package com.eqms.util;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The words a person reads for a value the server keeps as a machine value: a status (IN_PROGRESS), a module (documents, audit-trail), an action or a kind. The one place
 * for this on the server: a list that sends a code also sends its label made here (or taken from the table that owns the status), so a screen never has to make
 * a code readable and never shows one. The machine value itself is never changed or removed; the label is added beside it.
 *
 * <p>Wording that is not just the code in Title Case is listed once below. Everything else becomes words: "READY_FOR_DISTRIBUTION" is "Ready for Distribution",
 * "PENDING_QA_CONFIRMATION" is "Pending QA Confirmation". A value that already contains a lower-case letter is a label already and is returned as it was written.
 */
public final class DisplayLabels {

    private DisplayLabels() {
    }

    /** Abbreviations that stay in capitals. */
    private static final Set<String> ACRONYMS = Set.of(
            "QA", "GMP", "SOP", "DCO", "SOD", "MFA", "KPI", "PDF", "DOCX", "XLSX", "SMTP", "API", "CAPA", "ID", "ALCOA", "JSON", "CSV", "SMS", "UUID", "WORM", "SFTP", "TLS", "NAS");

    /** Small connective words stay in lower case, unless they are the first word. */
    private static final Set<String> SMALL_WORDS = Set.of("for", "of", "and", "or", "in", "on", "to", "the", "a", "an");

    /**
     * The statuses whose label is not the code in Title Case. These are the words of the system's own status tables (document_statuses, revision_statuses,
     * controlled_copy_statuses, training_activity_statuses) and of the screens; keep them the same as those.
     */
    private static final Map<String, String> STATUS = Map.ofEntries(
            Map.entry("CLOSED_CANCELLED", "Closed - Cancelled"),
            Map.entry("CANCELLED", "Closed - Cancelled"),
            Map.entry("RESERVED", "Pending Document Approval"),
            Map.entry("NOT_VERIFIED", "Not Verified"));

    /** The names of the menus the modules are under (the same names as the screens: utils/moduleDisplay.ts). The keys are the canonical module keys. */
    private static final Map<String, String> MODULE = Map.ofEntries(
            Map.entry("documents", "Document Control"),
            Map.entry("training", "Training Management"),
            Map.entry("reports", "Reports"),
            Map.entry("audit-trail", "Audit Trail"),
            Map.entry("backup", "Backup & Restore"),
            Map.entry("security", "Security & Authorization"),
            Map.entry("settings", "Application Settings"),
            Map.entry("system-admin", "System Administration"),
            Map.entry("notifications", "Notifications"),
            Map.entry("preferences", "Preferences"),
            Map.entry("self_service", "Self-Service"),
            Map.entry("work-management", "Work Management"),
            Map.entry("system-information", "System Information"));

    /** True for a value written as the server keeps it: capitals and digits, with or without underscores (IN_PROGRESS, PLANNED). */
    public static boolean isMachineValue(String value) {
        return value != null && value.matches("[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*") && (value.contains("_") || value.length() >= 4 && !ACRONYMS.contains(value));
    }

    /** The label of a status. Null stays null; a value that is not a machine value (it is a label already) is returned as it was. */
    public static String status(String code) {
        if (code == null || code.isBlank()) {
            return code;
        }
        String trimmed = code.trim();
        if (!isMachineValue(trimmed)) {
            return trimmed;
        }
        return STATUS.getOrDefault(trimmed, humanize(trimmed));
    }

    /** The label of an action, a kind, a method or any other machine value: the words of the code in Title Case. */
    public static String value(String code) {
        return status(code);
    }

    /** The name of a module as the menu names it; any other key is made into words. */
    public static String module(String key) {
        if (key == null || key.isBlank()) {
            return key;
        }
        String known = MODULE.get(ModuleKeys.canonical(key));
        if (known != null) {
            return known;
        }
        return isMachineValue(key.trim()) ? humanize(key.trim()) : humanize(key.trim().replace('-', '_').replace(' ', '_'));
    }

    /** A code inside a sentence: two or more words of letters in capitals joined by underscores (RESTORE_DATABASE_FAILED). A number such as SOP_3.0.0 is not one. */
    private static final java.util.regex.Pattern CODE_IN_TEXT = java.util.regex.Pattern.compile("\\b[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)+\\b");

    /** The preparation items an old audit comment names in capitals: "Session S1, MATERIALS". */
    private static final java.util.regex.Pattern PREPARATION_ITEM_IN_TEXT = java.util.regex.Pattern.compile("(Session S\\d+, )(VENUE|EQUIPMENT|MATERIALS|NOTICE)\\b");

    /** "Severity: HIGH" in a sentence. */
    private static final java.util.regex.Pattern SEVERITY_IN_TEXT = java.util.regex.Pattern.compile("(?i)(severity: )(CRITICAL|HIGH|MEDIUM|LOW|WARNING|INFO)\\b");

    /**
     * A sentence with every machine code in it written as words: "The test restore failed: RESTORE_DATABASE_FAILED" reads "... failed: Restore Database Failed". Used on the text
     * of a message that was written with a code in it (notifications, alert details), so a person never reads one. Text with no such code is returned as it was.
     */
    public static String prose(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        String words = CODE_IN_TEXT.matcher(text).replaceAll(match -> java.util.regex.Matcher.quoteReplacement(humanize(match.group())));
        words = PREPARATION_ITEM_IN_TEXT.matcher(words).replaceAll(match -> java.util.regex.Matcher.quoteReplacement(match.group(1) + humanize(match.group(2))));
        return SEVERITY_IN_TEXT.matcher(words).replaceAll(match -> java.util.regex.Matcher.quoteReplacement(match.group(1) + humanize(match.group(2))));
    }

    /** "READY_FOR_DISTRIBUTION" -> "Ready for Distribution". */
    public static String humanize(String code) {
        String[] words = code.trim().split("[_\\s]+");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            if (word.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            String lower = word.toLowerCase(Locale.ROOT);
            if (ACRONYMS.contains(word.toUpperCase(Locale.ROOT))) {
                out.append(word.toUpperCase(Locale.ROOT));
            } else if (i > 0 && SMALL_WORDS.contains(lower)) {
                out.append(lower);
            } else {
                out.append(Character.toUpperCase(lower.charAt(0))).append(lower.substring(1));
            }
        }
        return out.toString();
    }
}
