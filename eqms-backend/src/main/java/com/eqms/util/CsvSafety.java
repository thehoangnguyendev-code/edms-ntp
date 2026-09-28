package com.eqms.util;

/**
 * Shared CSV cell escaping used by every export path (Document, Revision, Controlled Copy).
 * Quotes/escapes per RFC 4180 AND neutralizes spreadsheet formula injection (DC-XF-67): a cell
 * whose first character is one Excel/LibreOffice/Sheets treats as a formula prefix (=, +, -, @) or
 * whose leading character is a tab or carriage return (both accepted as formula starts by some
 * spreadsheet CSV importers) gets a leading apostrophe, exactly the fix ReportPlatformService.csv()
 * already applied -- previously Document/Revision/Controlled Copy export had only the RFC 4180
 * quoting, not this neutralization.
 */
public final class CsvSafety {

    private CsvSafety() {
    }

    public static String escapeCell(String value) {
        if (value == null) {
            return "";
        }
        String v = value;
        if (v.startsWith("=") || v.startsWith("+") || v.startsWith("-") || v.startsWith("@")
                || v.startsWith("\t") || v.startsWith("\r")) {
            v = "'" + v;
        }
        String escaped = v.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }
}
