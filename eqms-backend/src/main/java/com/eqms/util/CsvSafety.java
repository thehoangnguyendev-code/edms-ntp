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

    /**
     * Byte order mark written at the very start of every CSV file that is exported. It is the three bytes EF BB BF of UTF-8; Excel and the other
     * spreadsheet programs read it as "this file is UTF-8", so Vietnamese text opens correctly and the program does not ask for the encoding.
     */
    public static final String BOM = "﻿";

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
