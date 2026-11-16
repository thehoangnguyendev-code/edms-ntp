package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** REPORT-SIGNATURE-IN-FILE-2026-11-13: a file of a run that was signed at the request says who signed, when, why and under which signature number; any other file says nothing of it. */
class ReportSignatureInFileTest {
    private static Map<String, String> values(boolean signed) {
        var values = new HashMap<String, String>(Map.of("report.title", "T", "report.code", "C", "template.version", "1.0.0", "report.executor", "Admin",
                "report.generatedAt", "13/11/2026 00:04:19", "report.asOfAt", "13/11/2026 00:04:19", "template.name", "T", "report.runId", "r",
                "report.gmpNotice", "Not approved for GMP decisions."));
        if (signed) values.putAll(Map.of("report.signedBy", "Nguyen The Hoang", "report.signedAt", "13/11/2026 00:04:17",
                "report.signatureReason", "Quarterly review of the activity of the report module", "report.signatureId", "ESIG-2026-009445"));
        return values;
    }

    @Test
    void everyPageOfASignedPdfNamesTheSignerTheTimeAndTheSignature() throws Exception {
        var rows = new ArrayList<List<String>>();
        rows.add(List.of("Document"));
        for (int i = 0; i < 120; i++) rows.add(List.of("SOP." + i));
        var layout = new ReportLayout(false, "", "", false, false, "", "", false, false, "x", false, "x");
        try (var pdf = Loader.loadPDF(ReportPresentationRenderer.render("PDF", rows, layout, values(true)))) {
            assertTrue(pdf.getNumberOfPages() > 1);
            for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                var stripper = new PDFTextStripper();
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String text = stripper.getText(pdf);
                assertTrue(text.contains("Signed electronically by Nguyen The Hoang on 13/11/2026 00:04:17 (UTC+7), signature ESIG-2026-009445."), "page " + page);
                assertTrue(text.contains("Not approved for GMP decisions."), "the statement of GMP status stays: page " + page);
            }
        }
    }

    @Test
    void anUnsignedPdfSaysNothingOfASignature() throws Exception {
        var layout = new ReportLayout(false, "", "", false, false, "", "", false, false, "x", false, "x");
        try (var pdf = Loader.loadPDF(ReportPresentationRenderer.render("PDF", List.of(List.of("Document"), List.of("SOP.1")), layout, values(false)))) {
            assertFalse(new PDFTextStripper().getText(pdf).contains("Signed electronically"));
        }
    }

    @Test
    void aSignedSpreadsheetStatesTheSignatureOnItsInformationSheetAndInThePrintedFooter() throws Exception {
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(ReportPresentationRenderer.render("XLSX", List.of(List.of("A"), List.of("x")), ReportLayout.defaults(), values(true))))) {
            var shown = new HashMap<String, String>();
            for (var row : book.getSheet("Report information")) shown.put(row.getCell(0).getStringCellValue(), row.getCell(1).getStringCellValue());
            assertEquals("Nguyen The Hoang", shown.get("Signed by"));
            assertEquals("13/11/2026 00:04:17", shown.get("Signed on (UTC+7)"));
            assertEquals("Quarterly review of the activity of the report module", shown.get("Reason for signing"), "the reason in full");
            assertEquals("ESIG-2026-009445", shown.get("Signature"));
            assertEquals("Report Run Requested", shown.get("Signature meaning"));
            String footer = book.getSheet("Report").getFooter().getCenter();
            assertTrue(footer.contains("Not approved for GMP decisions.") && footer.contains("Signed by Nguyen The Hoang, signature ESIG-2026-009445."), footer);
        }
    }

    @Test
    void anUnsignedSpreadsheetHasNoSignatureRows() throws Exception {
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(ReportPresentationRenderer.render("XLSX", List.of(List.of("A"), List.of("x")), ReportLayout.defaults(), values(false))))) {
            for (var row : book.getSheet("Report information")) assertFalse(row.getCell(0).getStringCellValue().startsWith("Signature") || row.getCell(0).getStringCellValue().startsWith("Signed"));
            assertFalse(book.getSheet("Report").getFooter().getCenter().contains("Signed"));
        }
    }
}
