package com.eqms.service.report;

/**
 * Draws a chart of a report as a PNG picture. The charts of the reports are drawn on the server by the chart renderer, which runs Chart.js (REPORT-CHARTJS-2026-11-15); the
 * browser draws none of them. A renderer that cannot be reached is a failure to be tried again, never a chart drawn some other way.
 */
public interface ChartImageRenderer {
    /** @param fontKey the font of the report (see ReportFonts); null is the default font. */
    byte[] png(ReportCharts.Result chart, String fontKey) throws Exception;
}
