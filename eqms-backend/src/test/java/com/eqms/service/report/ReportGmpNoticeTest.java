package com.eqms.service.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** REPORT-GMP-NOTICE-2026-11-12: every report file says whether it is confirmed for GMP decisions, and a layout cannot remove the statement. */
class ReportGmpNoticeTest {
    private final ObjectMapper json = new ObjectMapper();

    private com.fasterxml.jackson.databind.JsonNode definition(boolean gmp, String approval, int approvedVersion) {
        var node = json.createObjectNode();
        node.put("gmpUse", gmp).put("approvalStatus", approval).put("approvedVersion", approvedVersion).put("definitionVersion", 3)
                .put("revision", 2).put("approvedAt", "2026-11-05T08:30:00Z");
        return node;
    }

    private static final String RUN = "3f2a9c1e-0b7d-4a55-9d1e-7c2b6a8e4f10";

    @Test
    void aTemplateForGmpDecisionsThatIsApprovedNamesTheApproverTheRevisionTheDateAndTheRun() {
        assertEquals("For GMP decisions. Template revision 2.0.0 approved by Tran Thi Dieu Linh on 05/11/2026 15:30:00. Report run " + RUN
                        + "; data as of 15/11/2026 10:00:00; generated 15/11/2026 10:00:05.",
                ReportTemplateService.gmpNotice(definition(true, "APPROVED", 3), "Tran Thi Dieu Linh", RUN, "15/11/2026 10:00:00", "15/11/2026 10:00:05"));
    }

    @Test
    void everyOtherReportIsNotApprovedForGmpDecisionsAndNamesItsRun() {
        String expected = "Not approved for GMP decisions. Not a controlled record. Report run " + RUN + "; data as of 15/11/2026 10:00:00; generated 15/11/2026 10:00:05.";
        assertEquals(expected, ReportTemplateService.gmpNotice(definition(false, "APPROVED", 3), "Someone", RUN, "15/11/2026 10:00:00", "15/11/2026 10:00:05"));
        assertEquals(expected, ReportTemplateService.gmpNotice(definition(true, "DRAFT", 3), "Someone", RUN, "15/11/2026 10:00:00", "15/11/2026 10:00:05"), "not approved");
        assertEquals(expected, ReportTemplateService.gmpNotice(definition(true, "APPROVED", 2), "Someone", RUN, "15/11/2026 10:00:00", "15/11/2026 10:00:05"), "approval is of an older version");
    }

    @Test
    void anApproverWhoCannotBeNamedIsLeftOutAndNeverReplacedByAnIdentifier() {
        assertEquals("For GMP decisions. Template revision 2.0.0 approved on 05/11/2026 15:30:00. Report run " + RUN + "; data as of 15/11/2026 10:00:00.",
                ReportTemplateService.gmpNotice(definition(true, "APPROVED", 3), null, RUN, "15/11/2026 10:00:00", null));
    }

    private static final List<List<String>> ROWS = List.of(List.of("Document"), List.of("SOP.0001"), List.of("SOP.0002"));
    private static Map<String, String> values(String notice) {
        var values = new HashMap<String, String>(Map.of("report.title", "Review report", "report.code", "RPT.0023", "template.version", "1.0.0", "report.executor", "Admin",
                "report.generatedAt", "2026-11-12T10:00:00Z", "report.asOfAt", "2026-11-12T10:00:00Z", "template.name", "Review report", "report.runId", "run"));
        if (notice != null) values.put("report.gmpNotice", notice);
        return values;
    }

    @Test
    void thePdfCarriesTheStatementOnEveryPageEvenWhenTheLayoutHasNoFooter() throws Exception {
        var rows = new ArrayList<List<String>>();
        rows.add(List.of("Document"));
        for (int i = 0; i < 120; i++) rows.add(List.of("SOP." + i));
        var layout = new ReportLayout(false, "", "", false, false, "", "", false, false, "x", false, "x");
        byte[] bytes = ReportPresentationRenderer.render("PDF", rows, layout, values("Not approved for GMP decisions."));
        try (var pdf = Loader.loadPDF(bytes)) {
            assertTrue(pdf.getNumberOfPages() > 1);
            for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                var stripper = new PDFTextStripper();
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                assertTrue(stripper.getText(pdf).contains("Not approved for GMP decisions."), "page " + page);
            }
        }
    }

    @Test
    void theSpreadsheetStatesItOnTheInformationSheetAndInThePrintedFooter() throws Exception {
        var layout = ReportLayout.defaults();
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(ReportPresentationRenderer.render("XLSX", ROWS, layout, values("For GMP decisions. Template revision 1.0.0 approved by A on 2026-11-05."))))) {
            var info = book.getSheet("Report information");
            boolean found = false;
            for (var row : info) if ("GMP status".equals(row.getCell(0).getStringCellValue())) { found = true; assertTrue(row.getCell(1).getStringCellValue().startsWith("For GMP decisions.")); }
            assertTrue(found);
            assertTrue(book.getSheet("Report").getFooter().getCenter().startsWith("For GMP decisions."));
        }
    }

    @Test
    void aFileMadeWithoutAStatementShowsNone() throws Exception {
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(ReportPresentationRenderer.render("XLSX", ROWS, ReportLayout.defaults(), values(null))))) {
            for (var row : book.getSheet("Report information")) assertNotEquals("GMP status", row.getCell(0).getStringCellValue());
        }
    }

    @Test
    void aRunIsQuotedByItsNumberNeverByItsIdentifier() {
        assertEquals("RUN-000123", com.eqms.service.ReportPlatformService.runLabel(123L));
        assertEquals("RUN-000007", com.eqms.service.ReportPlatformService.runLabel(7));
        assertEquals("", com.eqms.service.ReportPlatformService.runLabel(null));
    }
}
