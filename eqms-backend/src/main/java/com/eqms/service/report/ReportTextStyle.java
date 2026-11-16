package com.eqms.service.report;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Set;

/**
 * How a text of the report is set (REPORT-TEXT-STYLE-2026-11-14): font, size in points, colour, bold, italic, underline and alignment. Every value is optional: a text without
 * a value is set as the report was set before styles existed, so a layout saved earlier is drawn the same. The values are checked against fixed lists (the bundled fonts, a
 * six-digit colour), never taken as they come.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ReportTextStyle(String font, Integer size, String color, Boolean bold, Boolean italic, Boolean underline, String align, String transform) {
    public static final Set<String> ALIGNS = Set.of("LEFT", "CENTER", "RIGHT");
    public static final Set<String> TRANSFORMS = Set.of("UPPERCASE", "LOWERCASE", "CAPITALIZE");

    /** As the style was before the text transform. */
    public ReportTextStyle(String font, Integer size, String color, Boolean bold, Boolean italic, Boolean underline, String align) {
        this(font, size, color, bold, italic, underline, align, null);
    }

    /** The text as it is printed: upper case, lower case or the first letter of each word in capitals; as it was written when none is set. */
    public String apply(String text) {
        if (text == null || transform == null) return text;
        return switch (transform) {
            case "UPPERCASE" -> text.toUpperCase(java.util.Locale.ROOT);
            case "LOWERCASE" -> text.toLowerCase(java.util.Locale.ROOT);
            case "CAPITALIZE" -> capitalize(text);
            default -> text;
        };
    }

    private static String capitalize(String text) {
        var out = new StringBuilder(text.length());
        boolean start = true;
        for (int i = 0; i < text.length(); ) {
            int point = text.codePointAt(i);
            out.appendCodePoint(start ? Character.toUpperCase(point) : point);
            start = Character.isWhitespace(point);
            i += Character.charCount(point);
        }
        return out.toString();
    }

    /** True when nothing is set: the text is drawn as it always was. */
    public boolean plain() { return font == null && size == null && color == null && bold == null && italic == null && underline == null && align == null && transform == null; }

    /** The font family of the text: its own, or the one of the report. */
    public String effectiveFont(String reportFont) { return font == null || font.isBlank() ? reportFont : font; }

    /** The size of the text: its own, or the one the place of the text has by default. */
    public int effectiveSize(int fallback) { return size == null ? fallback : size; }

    /** The same style with another alignment: the name of a column of the approval table is aligned by its column, the rest of the style stays. */
    public ReportTextStyle withAlign(String newAlign) { return new ReportTextStyle(font, size, color, bold, italic, underline, newAlign, transform); }

    public String effectiveAlign(String fallback) { return align == null ? fallback : align; }

    public void validated() {
        if (font != null && !ReportFonts.KEYS.contains(font)) throw new IllegalArgumentException("REPORT_TEXT_STYLE_INVALID");
        if (size != null && (size < 6 || size > 48)) throw new IllegalArgumentException("REPORT_TEXT_STYLE_INVALID");
        if (color != null && !color.matches("#[0-9a-fA-F]{6}")) throw new IllegalArgumentException("REPORT_TEXT_STYLE_INVALID");
        if (align != null && !ALIGNS.contains(align)) throw new IllegalArgumentException("REPORT_TEXT_STYLE_INVALID");
        if (transform != null && !TRANSFORMS.contains(transform)) throw new IllegalArgumentException("REPORT_TEXT_STYLE_INVALID");
    }

    /** Checks a style that may be absent. */
    public static void validate(ReportTextStyle style) { if (style != null) style.validated(); }
}
