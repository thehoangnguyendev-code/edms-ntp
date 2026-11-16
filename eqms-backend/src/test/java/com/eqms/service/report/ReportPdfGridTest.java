package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

/** REPORT-PDF-GRID-2026-11-16: the table of a PDF report has no "Metadata report" label above it and is drawn with lines between the columns and above the header. */
class ReportPdfGridTest {
    private static List<List<String>> rows(int count) {
        var rows = new ArrayList<List<String>>();
        rows.add(List.of("No.", "Number", "Name", "Status"));
        for (int i = 1; i <= count; i++) rows.add(List.of(String.valueOf(i), "SOP." + i, "Validation of an analytical method number " + i, "Active"));
        return rows;
    }

    @Test
    void theTableHasNoMetadataLabelOnAnyPageAndTheHeaderIsRepeated() throws Exception {
        byte[] bytes = ReportPdfRenderer.render(rows(120));
        try (var pdf = Loader.loadPDF(bytes)) {
            assertTrue(pdf.getNumberOfPages() > 1, "more than one page");
            String text = new PDFTextStripper().getText(pdf);
            assertFalse(text.contains("Metadata report"), "the label is gone");
            assertFalse(text.contains("Page 1"), "no page label in the table");
            // the header is drawn once on each page
            assertEquals(pdf.getNumberOfPages(), text.split("Status", -1).length - 1);
        }
        Files.createDirectories(Path.of("target"));
        Files.write(Path.of("target/report-grid.pdf"), bytes);
    }

    @Test
    void theLinesOfTheFrameAreInTheContentOfEveryPage() throws Exception {
        try (var pdf = Loader.loadPDF(ReportPdfRenderer.render(rows(120)))) {
            for (var page : pdf.getPages()) {
                String content = new String(page.getContents().readAllBytes(), java.nio.charset.StandardCharsets.ISO_8859_1);
                // a line is "x y m x y l S"; the frame has many (rows, columns, header)
                long strokes = content.lines().filter(line -> line.trim().equals("S")).count();
                assertTrue(strokes > 30, "the page has the lines of the table: " + strokes);
            }
        }
    }
}
