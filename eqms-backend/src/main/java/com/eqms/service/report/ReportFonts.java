package com.eqms.service.report;

import java.util.Set;

/**
 * The fonts a report can use, all bundled with the application so that a report reads the same on every host and can show Vietnamese. TIMES_NEW_ROMAN is
 * Tinos (SIL Open Font License, see fonts/Tinos-OFL.txt), the free font that has the same letter widths as Times New Roman, so the lines of a report break
 * where they would in Times New Roman; the Microsoft font itself is not licensed for embedding.
 */
public final class ReportFonts {
    private ReportFonts() {}
    public static final Set<String> KEYS = Set.of("NOTO_SANS", "NOTO_SERIF", "ROBOTO_MONO", "OSWALD", "TIMES_NEW_ROMAN");

    /** The font of the running text of a report: cover, header, footer, page numbers, the table and the charts. */
    public static String bodyResource(String key) {
        return "/fonts/" + switch (key == null ? "NOTO_SANS" : key) {
            case "NOTO_SERIF" -> "NotoSerif-Bold.ttf";
            case "ROBOTO_MONO" -> "RobotoMono-Bold.ttf";
            case "OSWALD" -> "Oswald-Bold.ttf";
            case "TIMES_NEW_ROMAN" -> "Tinos-Regular.ttf";
            default -> "NotoSans-Bold.ttf";
        };
    }

    /** The font of a stamp or a watermark (heavier, so it reads at a distance). */
    public static String markResource(String key) {
        return "/fonts/" + switch (key == null ? "NOTO_SANS" : key) {
            case "NOTO_SERIF" -> "NotoSerif-Bold.ttf";
            case "ROBOTO_MONO" -> "RobotoMono-Bold.ttf";
            case "OSWALD" -> "Oswald-Bold.ttf";
            case "TIMES_NEW_ROMAN" -> "Tinos-Bold.ttf";
            default -> "NotoSans-Bold.ttf";
        };
    }

    /** The report font as it has always been drawn: the bundled Noto, Roboto Mono and Oswald files are weight 700, Tinos is regular. A text with no bold setting keeps that. */
    public static boolean legacyBold(String key) { return !"TIMES_NEW_ROMAN".equals(key == null ? "NOTO_SANS" : key); }

    /** True when the family has a real italic file; Oswald has none, and its italic is the upright letters slanted. */
    public static boolean hasItalic(String key) { return !"OSWALD".equals(key); }

    /** The file of one family in one weight and slant (REPORT-TEXT-STYLE-2026-11-14); an italic that the family does not have is the upright file. */
    public static String styledResource(String key, boolean bold, boolean italic) {
        String family = switch (key == null ? "NOTO_SANS" : key) {
            case "NOTO_SERIF" -> "NotoSerif";
            case "ROBOTO_MONO" -> "RobotoMono";
            case "OSWALD" -> "Oswald";
            case "TIMES_NEW_ROMAN" -> "Tinos";
            default -> "NotoSans";
        };
        boolean slanted = italic && hasItalic(key);
        return "/fonts/" + family + "-" + (bold ? (slanted ? "BoldItalic" : "Bold") : (slanted ? "Italic" : "Regular")) + ".ttf";
    }
}
