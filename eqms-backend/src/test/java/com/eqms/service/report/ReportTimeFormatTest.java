package com.eqms.service.report;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * REPORT-TIME-FORMAT-2026-11-12: a report writes a date as dd/MM/yyyy and a moment as dd/MM/yyyy HH:mm:ss in UTC+7, like every other screen and document of the system. It never
 * changes a text a person typed, even one that looks like a date.
 */
class ReportTimeFormatTest {
    @Test
    void aMomentFromTheDatabaseIsWrittenInTheZoneOfTheSite() {
        // 16:44:23 UTC is 23:44:23 in UTC+7
        assertEquals("12/11/2026 23:44:23", ReportTemplateService.cell(java.sql.Timestamp.from(Instant.parse("2026-11-12T16:44:23.981046Z")), false));
        // a moment near midnight UTC is already the next day in UTC+7
        assertEquals("13/11/2026 05:30:00", ReportTemplateService.cell(java.sql.Timestamp.from(Instant.parse("2026-11-12T22:30:00Z")), false));
    }

    @Test
    void aDateColumnIsWrittenAsADate() {
        assertEquals("28/07/2026", ReportTemplateService.cell(java.sql.Date.valueOf("2026-07-28"), false));
        assertEquals("28/07/2026", ReportTemplateService.cell("2026-07-28", true));
        assertEquals("12/11/2026 23:39:16", ReportTemplateService.cell("2026-11-12 23:39:16", true), "a text a column built with to_char is in the zone of the site");
        assertEquals("12/11/2026 23:39:16", ReportTemplateService.cell("2026-11-12 23:39:16.372586+07", true));
    }

    @Test
    void aTextThatAPersonTypedIsNeverChanged() {
        assertEquals("2026-07-28", ReportTemplateService.cell("2026-07-28", false), "a document name that looks like a date is a name");
        assertEquals("Hoàng test 10/08/2026", ReportTemplateService.cell("Hoàng test 10/08/2026", false));
        assertEquals("", ReportTemplateService.cell(null, true));
        assertEquals("42", ReportTemplateService.cell(42, false));
        assertEquals("-107", ReportTemplateService.cell(-107, false));
    }

    @Test
    void aMonthlyTrendReadsTheDisplayFormatAndLabelsItsMonthsMmYyyy() {
        var chart = new ReportLayout.Chart("By month", "LINE", "createdAt", "COUNT", null);
        var rows = List.of(List.of("Created"), List.of("03/10/2026"), List.of("05/10/2026 10:00:00"), List.of("01/12/2026"));
        var points = ReportCharts.calculate(List.of(chart), List.of("createdAt"), rows).getFirst().points();
        assertEquals(List.of("10/2026", "12/2026"), points.stream().map(ReportCharts.Point::label).toList(), "in time order");
        assertEquals(2, points.getFirst().count());
    }

    @Test
    void theInformationOfAFileStatesTheZoneOfItsTimes() throws Exception {
        var values = Map.of("report.title", "T", "report.code", "C", "template.version", "1", "report.executor", "A", "report.generatedAt", "12/11/2026 23:44:23",
                "report.asOfAt", "12/11/2026 23:44:20", "template.name", "T", "report.runId", "r");
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(ReportPresentationRenderer.render("XLSX", List.of(List.of("A"), List.of("x")), ReportLayout.defaults(), values)))) {
            var shown = new HashMap<String, String>();
            for (var row : book.getSheet("Report information")) shown.put(row.getCell(0).getStringCellValue(), row.getCell(1).getStringCellValue());
            assertEquals("12/11/2026 23:44:23", shown.get("Generated at (UTC+7)"));
            assertEquals("12/11/2026 23:44:20", shown.get("Data as of (UTC+7)"));
            assertFalse(shown.containsKey("Generated at (UTC)"));
        }
    }
}
