package com.eqms.service.report;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * REPORT-LARGE-RUN-2026-11-12: a Full run of 100,000 rows in XLSX must not need the whole sheet in memory. The workbook is written as a stream; on DEV at the heap of the
 * container (768 MB) the earlier form ran out of memory at 100,000 rows of 12 columns.
 */
class ReportLargeRunTest {
    private static final int ROWS = 100_000;

    @Test
    void aFullRunOfOneHundredThousandRowsIsWrittenAsAWorkbookWithEveryRowAndTheStatement() throws Exception {
        var rows = new ArrayList<List<String>>(ROWS + 1);
        rows.add(List.of("Document Number", "Document Name", "Status", "Department"));
        for (int i = 0; i < ROWS; i++) rows.add(List.of("SOP." + i, "Validation and verification of analytical method " + i, "Active", "Quality Control"));
        var values = Map.of("report.title", "Big", "report.code", "RPT.X", "template.version", "1.0.0", "report.executor", "Admin", "report.generatedAt", "2026-11-12T10:00:00Z",
                "report.asOfAt", "2026-11-12T10:00:00Z", "template.name", "Big", "report.runId", "run", "report.gmpNotice", "Not approved for GMP decisions.");
        byte[] bytes = ReportPresentationRenderer.render("XLSX", rows, ReportLayout.defaults(), values);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            var sheet = book.getSheet("Report");
            assertEquals(ROWS, sheet.getLastRowNum(), "the header and every row");
            // REPORT-ROW-NUMBER-2026-11-16: the first column is "No.", counted from 1; the data starts in the second column.
            assertEquals("No.", sheet.getRow(0).getCell(0).getStringCellValue());
            assertEquals(String.valueOf(ROWS), sheet.getRow(ROWS).getCell(0).getStringCellValue());
            assertEquals("SOP." + (ROWS - 1), sheet.getRow(ROWS).getCell(1).getStringCellValue());
            assertEquals("Document Number", sheet.getRow(0).getCell(1).getStringCellValue());
            assertTrue(sheet.getColumnWidth(2) > sheet.getColumnWidth(3), "the name column is wider than the status column");
            assertTrue(sheet.getColumnWidth(2) <= 60 * 256, "a column is never wider than 60 characters");
            assertNotNull(book.getSheet("Report information"));
        }
    }

    @Test
    void aWorkbookWithAChartKeepsItsAnalysisSheetAndPicture() throws Exception {
        StubChartRenderer.install();
        var rows = List.of(List.of("Status"), List.of("Active"), List.of("Draft"), List.of("Active"));
        var chart = new ReportLayout.Chart("By status", "BAR", "status", "COUNT", null);
        var calculated = ReportCharts.calculate(List.of(chart), List.of("status"), rows);
        byte[] bytes = ReportPresentationRenderer.render("XLSX", rows, ReportLayout.defaults(), Map.of("report.title", "T", "report.code", "C", "template.version", "1", "report.executor", "A",
                "report.generatedAt", "g", "report.asOfAt", "a", "template.name", "T", "report.runId", "r"), calculated);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertNotNull(book.getSheet("Analysis 1"));
            assertEquals(1, book.getAllPictures().size());
        }
    }
}
