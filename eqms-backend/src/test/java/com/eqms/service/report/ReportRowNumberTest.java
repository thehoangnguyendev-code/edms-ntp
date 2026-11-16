package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

/** REPORT-ROW-NUMBER-2026-11-16: every report file has the column "No." in front, counted from 1. */
class ReportRowNumberTest {
    private static final Map<String, String> VALUES = Map.of("report.title", "T", "report.code", "C", "template.version", "1", "report.executor", "A",
            "report.generatedAt", "g", "report.asOfAt", "a", "template.name", "T", "report.runId", "r", "report.gmpNotice", "");

    @Test
    void theNumberColumnIsInFrontAndCountsFromOne() {
        var numbered = ReportPresentationRenderer.withRowNumbers(List.of(List.of("Name", "Status"), List.of("A", "Active"), List.of("B", "Draft")));
        assertEquals(List.of("No.", "Name", "Status"), numbered.get(0));
        assertEquals(List.of("1", "A", "Active"), numbered.get(1));
        assertEquals(List.of("2", "B", "Draft"), numbered.get(2));
    }

    @Test
    void aReportWithNoRowsStaysAsItIs() {
        assertEquals(List.of(), ReportPresentationRenderer.withRowNumbers(List.of()));
        assertEquals(List.of(List.of("No.", "Name")), ReportPresentationRenderer.withRowNumbers(List.of(List.of("Name"))));
    }

    @Test
    void theSpreadsheetHasTheNumberColumnAndTheChartsStillReadTheirOwnColumn() throws Exception {
        StubChartRenderer.install();
        var rows = List.of(List.of("Status"), List.of("Active"), List.of("Draft"), List.of("Active"));
        var chart = new ReportLayout.Chart("By status", "BAR", "status", "COUNT", null);
        var calculated = ReportCharts.calculate(List.of(chart), List.of("status"), rows);
        byte[] bytes = ReportPresentationRenderer.render("XLSX", rows, ReportLayout.defaults(), VALUES, calculated);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            var sheet = book.getSheet("Report");
            assertEquals("No.", sheet.getRow(0).getCell(0).getStringCellValue());
            assertEquals("Status", sheet.getRow(0).getCell(1).getStringCellValue());
            assertEquals("3", sheet.getRow(3).getCell(0).getStringCellValue());
            assertEquals("Active", sheet.getRow(3).getCell(1).getStringCellValue());
            assertNotNull(book.getSheet("Analysis 1"), "the chart was counted from the chosen column, not from the number column");
            assertEquals(2.0, calculated.getFirst().points().stream().filter(point -> "Active".equals(point.label())).findFirst().orElseThrow().value(), 0.001);
        }
    }
}
