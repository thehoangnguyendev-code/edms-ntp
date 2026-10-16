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
}
