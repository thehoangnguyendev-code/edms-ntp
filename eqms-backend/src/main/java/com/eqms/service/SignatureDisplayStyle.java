package com.eqms.service;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The three ways a signed electronic signature is shown in a document. All three are drawn from the same electronic signature record: they differ only in how much of it is
 * written, never in what the record holds. A placeholder chooses one by its name: {@code {{approvedSignatureCompact}}}, {@code {{approvedSignatureStandard}}} or
 * {@code {{approvedSignatureDetailed}}} (also {@code reviewerSignature1Compact}, {@code approverSignaturesStandard} and the other signature placeholders). A placeholder with no
 * such ending keeps the full block it always had.
 */
public enum SignatureDisplayStyle {
    /** Name, then the meaning and the date and time on one line: for the signature cells of the table at the top of a document. */
    COMPACT("Compact", "Small frame"),
    /** Name, "Electronically" and the meaning, then the date and time: for a signature area of its own. */
    STANDARD("Standard", "Standard frame"),
    /** Name, the meaning and the date and time to the second, then the signature ID: for a signature page or an important record. */
    DETAILED("Detailed", "Frame with the signature ID");

    private static final Pattern SUFFIX = Pattern.compile("^(.*?)[_\\-\\s]?(compact|standard|detailed)$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final String label;
    private final String frame;

    SignatureDisplayStyle(String label, String frame) {
        this.label = label;
        this.frame = frame;
    }

    public String label() {
        return label;
    }

    public String frame() {
        return frame;
    }

    /** The style a placeholder name asks for, or {@code null} when it names none. Only names that are signature placeholders are looked at. */
    public static SignatureDisplayStyle ofName(String placeholderName) {
        Matcher matcher = match(placeholderName);
        return matcher == null ? null : valueOf(matcher.group(2).toUpperCase(Locale.ROOT));
    }

    /** The placeholder name without its style ending ({@code approvedSignatureCompact} becomes {@code approvedSignature}); the name itself when it has none. */
    public static String baseName(String placeholderName) {
        Matcher matcher = match(placeholderName);
        return matcher == null ? placeholderName : matcher.group(1);
    }

    private static Matcher match(String placeholderName) {
        if (placeholderName == null) return null;
        String name = placeholderName.trim();
        // the transform part (after a pipe) is not part of the name
        int pipe = name.indexOf('|');
        if (pipe >= 0) name = name.substring(0, pipe).trim();
        Matcher matcher = SUFFIX.matcher(name);
        if (!matcher.matches() || !matcher.group(1).toLowerCase(Locale.ROOT).replaceAll("[_\\-\\s]+", "").matches(".*signatures?\\d*$")) return null;
        return matcher;
    }
}
