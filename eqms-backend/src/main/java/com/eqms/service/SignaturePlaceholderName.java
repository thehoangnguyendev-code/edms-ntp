package com.eqms.service;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A signed electronic signature is written in a document in one way only: the Standard frame (the signer's name, "Electronically" and the meaning, then the date and time). Every
 * signature placeholder ({@code {{approvedSignature}}}, {@code {{reviewerSignature1}}}, {@code {{approverSignatures}}} and the like) gets it.
 * <p>
 * Templates written while there were three styles may still carry a style ending ({@code {{approvedSignatureCompact}}}, {@code {{approvedSignatureStandard}}},
 * {@code {{approvedSignatureDetailed}}}). Such a name is read as the same placeholder without the ending, so that a template already stored is still filled; the endings are not
 * listed in the catalog any more and a style is never chosen by a name.
 */
public final class SignaturePlaceholderName {
    private static final Pattern LEGACY_ENDING = Pattern.compile("^(.*?)[_\\-\\s]?(compact|standard|detailed)$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private SignaturePlaceholderName() {
    }

    /** The placeholder name without a style ending of the old templates ({@code approvedSignatureCompact} becomes {@code approvedSignature}); the name itself when it has none. */
    public static String baseName(String placeholderName) {
        if (placeholderName == null) return null;
        String name = placeholderName.trim();
        // the transform part (after a pipe) is not part of the name
        int pipe = name.indexOf('|');
        if (pipe >= 0) name = name.substring(0, pipe).trim();
        Matcher matcher = LEGACY_ENDING.matcher(name);
        if (!matcher.matches() || !matcher.group(1).toLowerCase(Locale.ROOT).replaceAll("[_\\-\\s]+", "").matches(".*signatures?\\d*$")) return placeholderName;
        return matcher.group(1);
    }

    /** Whether the name carries an ending of the old styles. */
    public static boolean hasLegacyEnding(String placeholderName) {
        return placeholderName != null && !baseName(placeholderName).equals(placeholderName);
    }
}
