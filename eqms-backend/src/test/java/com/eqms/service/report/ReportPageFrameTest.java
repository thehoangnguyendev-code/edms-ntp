package com.eqms.service.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;
import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** REPORT-APPEARANCE-2026-11-14: the frame of a page (header and footer in three places, information, approval, notes) and the logo that has a place instead of a position. */
class ReportPageFrameTest {
    static String logo() throws Exception {
        var image = new BufferedImage(600, 200, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics(); g.setColor(Color.GREEN); g.fillRect(0, 0, 600, 200); g.dispose();
        var png = new ByteArrayOutputStream(); ImageIO.write(image, "png", png);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(png.toByteArray());
    }
    static List<List<String>> rows(int count) {
        var rows = new ArrayList<List<String>>(); rows.add(List.of("Number", "Name"));
        for (int i = 0; i < count; i++) rows.add(List.of("SOP." + i, "Method " + i));
        return rows;
    }
    static Map<String, String> values() {
        return new HashMap<>(Map.of("report.title", "Due for review", "report.code", "RPT.0001", "template.version", "1.0", "report.executor", "Admin",
                "report.generatedAt", "14/11/2026 10:00:00", "report.asOfAt", "14/11/2026 10:00:00", "template.name", "T", "report.runId", "r", "report.rowCount", "7"));
    }
    static ReportLayout.Slot slot(String text) { return new ReportLayout.Slot(text, null); }
    static ReportLayout.Frame frame(boolean approval, boolean notes, List<ReportLayout.InfoItem> info) {
        return new ReportLayout.Frame("ACME", slot("{{report.title}}"), slot(""), slot(""), slot("{{company.name}}"), slot(""), slot(""), info, 2, approval, null, notes, 100);
    }
    static ReportLayout layout(ReportLayout.Logo logo, ReportLayout.Frame frame, String orientation) {
        return new ReportLayout(false, "", "", false, false, "Header text", "Footer text", true, false, "x", false, "x", null, null, logo, null, orientation, null, null, frame);
    }
    static String text(byte[] pdf, int page) throws Exception {
        try (var document = Loader.loadPDF(pdf)) {
            var stripper = new PDFTextStripper(); stripper.setSortByPosition(true); stripper.setStartPage(page); stripper.setEndPage(page); return stripper.getText(document);
        }
    }

    @Test
    void aLogoWithoutAPlaceIsPutInThePlaceItsCentreWasNearestTo() {
        assertEquals("LEFT", new ReportLayout.Logo(true, "x", 5, 8, 18, "ALL").effectiveSlot());
        assertEquals("CENTER", new ReportLayout.Logo(true, "x", 40, 8, 20, "ALL").effectiveSlot());
        assertEquals("RIGHT", new ReportLayout.Logo(true, "x", 80, 8, 18, "ALL").effectiveSlot());
        assertEquals("RIGHT", new ReportLayout.Logo(true, "x", 5, 8, 18, "ALL", "RIGHT").effectiveSlot());
    }

    @Test
    void theLogoOfTheOldDefaultPositionIsAboveTheTableNotOverIt() throws Exception {
        // This position (left 5%, top 8%, width 18%) used to be drawn over the heading of the table and its first rows.
        var layout = layout(new ReportLayout.Logo(true, logo(), 5, 8, 18, "ALL"), null, "LANDSCAPE");
        float[] rect = ReportPresentationRenderer.logoRect(layout);
        float tableTop = layout.pageHeight() - (ReportPresentationRenderer.headerBandHeight(layout) + 10);
        assertTrue(rect[1] >= tableTop, "the logo must end above where the table starts: logo bottom " + rect[1] + ", table top " + tableTop);
        assertTrue(rect[3] <= 70, "the logo is at most 70 points high");
    }

    @Test
    void aLogoThatIsTooBigIsShrunkToItsPlaceAndTheBandGrowsWithTheLogo() throws Exception {
        var big = layout(new ReportLayout.Logo(true, logo(), 0, 0, 100, "ALL", "LEFT"), null, "PORTRAIT");
        float[] rect = ReportPresentationRenderer.logoRect(big);
        assertTrue(rect[2] <= (595 - 60) / 3f + 0.01, "the logo is no wider than a third of the page");
        var small = layout(new ReportLayout.Logo(true, logo(), 0, 0, 5, "ALL", "LEFT"), null, "PORTRAIT");
        assertTrue(ReportPresentationRenderer.headerBandHeight(big) > ReportPresentationRenderer.headerBandHeight(small));
    }

    @Test
    void theOldHeaderTextMovesToTheOtherSideWhenTheLogoIsOnTheLeft() throws Exception {
        var frame = layout(new ReportLayout.Logo(true, logo(), 5, 8, 18, "ALL"), null, "LANDSCAPE").effectiveFrame();
        assertTrue(frame.header("LEFT").empty());
        assertEquals("Header text", frame.header("RIGHT").effectiveText());
        var noLogo = layout(null, null, "LANDSCAPE").effectiveFrame();
        assertEquals("Header text", noLogo.header("LEFT").effectiveText());
        assertEquals("Footer text", noLogo.footer("LEFT").effectiveText());
    }

    @Test
    void theInformationIsAboveTheTableAndTheApprovalAndNotesAreOnTheLastPageOnlyWhenSwitchedOn() throws Exception {
        var info = List.of(new ReportLayout.InfoItem("Rows", "{{report.rowCount}}"), new ReportLayout.InfoItem("Prepared by", "{{report.executor}}"));
        byte[] on = ReportPresentationRenderer.render("PDF", rows(3), layout(null, frame(true, true, info), "LANDSCAPE"), values());
        String first = text(on, 1);
        assertTrue(first.contains("Rows:") && first.contains("7") && first.contains("Prepared by:") && first.contains("Admin"));
        assertTrue(first.indexOf("Rows:") < first.indexOf("SOP.0"), "the information is above the table");
        try (var document = Loader.loadPDF(on)) {
            String last = text(on, document.getNumberOfPages());
            assertTrue(last.contains("Approval") && last.contains("Notes / Comments") && last.contains("Approved by") && last.contains("Designation") && last.contains("Sign") && last.contains("Date"));
        }
        byte[] off = ReportPresentationRenderer.render("PDF", rows(3), layout(null, frame(false, false, List.of()), "LANDSCAPE"), values());
        try (var document = Loader.loadPDF(off)) {
            assertEquals(1, document.getNumberOfPages());
            assertFalse(text(off, 1).contains("Approval"));
            assertFalse(text(off, 1).contains("Notes / Comments"));
        }
    }

    @Test
    void theHeaderAndFooterAreOnEveryPageWithTheNameOfTheCompanyAndThePageNumber() throws Exception {
        byte[] pdf = ReportPresentationRenderer.render("PDF", rows(80), layout(null, frame(false, false, List.of()), "PORTRAIT"), values());
        try (var document = Loader.loadPDF(pdf)) {
            assertTrue(document.getNumberOfPages() >= 2);
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                String text = text(pdf, page);
                assertTrue(text.contains("Due for review") && text.contains("ACME") && text.contains(page + " / " + document.getNumberOfPages()), "page " + page);
            }
        }
    }

    @Test
    void theSpreadsheetCarriesTheInformationAndTheHeaderAndFooterInThreePlaces() throws Exception {
        var info = List.of(new ReportLayout.InfoItem("Rows", "{{report.rowCount}}"));
        var frame = new ReportLayout.Frame("ACME", slot("L {{report.title}}"), slot("C"), slot("R"), slot("{{company.name}}"), slot(""), slot(""), info, 2, true, null, true, 100);
        byte[] xlsx = ReportPresentationRenderer.render("XLSX", rows(3), layout(new ReportLayout.Logo(true, logo(), 5, 8, 14, "ALL", "RIGHT"), frame, "LANDSCAPE"), values());
        try (var book = WorkbookFactory.create(new ByteArrayInputStream(xlsx))) {
            var information = book.getSheet("Report information");
            assertEquals("Rows", information.getRow(0).getCell(0).getStringCellValue());
            assertEquals("7", information.getRow(0).getCell(1).getStringCellValue());
            var sheet = book.getSheet("Report");
            assertEquals("L Due for review", sheet.getHeader().getLeft());
            assertEquals("C", sheet.getHeader().getCenter());
            assertEquals("R", sheet.getHeader().getRight());
            assertEquals("ACME", sheet.getFooter().getLeft());
            assertEquals("No.", sheet.getRow(0).getCell(0).getStringCellValue(), "the logo is not on the sheet of the data: it is data only, and its first column is the row number");
            assertEquals("Number", sheet.getRow(0).getCell(1).getStringCellValue());
        }
    }

    @Test
    void aLayoutSavedBeforeTheFrameStillReadsAndKeepsItsLook() throws Exception {
        var mapper = new ObjectMapper();
        String old = "{\"cover\":false,\"coverTitle\":\"\",\"subtitle\":\"\",\"showExecutor\":true,\"showGeneratedAt\":true,\"header\":\"{{report.title}}\",\"footer\":\"{{report.code}}\","
                + "\"pageNumbers\":true,\"watermarkEnabled\":false,\"watermark\":\"x\",\"stampEnabled\":false,\"stamp\":\"x\",\"logo\":{\"enabled\":false,\"data\":null,\"x\":5,\"y\":8,\"width\":18,\"pages\":\"ALL\"}}";
        var layout = mapper.readValue(old, ReportLayout.class);
        assertNull(layout.frame());
        assertEquals("{{report.title}}", layout.effectiveFrame().header("LEFT").effectiveText());
        layout.validated();
        // and a layout with a frame goes through JSON and back as it was
        var withFrame = layout(null, frame(true, true, List.of(new ReportLayout.InfoItem("Rows", "{{report.rowCount}}"))), "LANDSCAPE");
        assertEquals(withFrame.frame(), mapper.readValue(mapper.writeValueAsString(withFrame), ReportLayout.class).frame());
    }

    @Test
    void aFrameThatIsOutOfBoundsOrNamesAnUnknownPlaceholderIsRefused() throws Exception {
        for (var bad : List.of(
                new ReportLayout.Frame("", slot("{{password}}"), slot(""), slot(""), slot(""), slot(""), slot(""), null, null, false, null, false, null),
                new ReportLayout.Frame("", slot("1\n2\n3\n4\n5\n6"), slot(""), slot(""), slot(""), slot(""), slot(""), null, null, false, null, false, null),
                new ReportLayout.Frame("", new ReportLayout.Slot("x", 40), slot(""), slot(""), slot(""), slot(""), slot(""), null, null, false, null, false, null),
                new ReportLayout.Frame("", slot(""), slot(""), slot(""), slot(""), slot(""), slot(""), null, 3, false, null, false, null),
                new ReportLayout.Frame("", slot(""), slot(""), slot(""), slot(""), slot(""), slot(""), null, null, false, null, true, 5),
                new ReportLayout.Frame("", slot(""), slot(""), slot(""), slot(""), slot(""), slot(""), List.of(new ReportLayout.InfoItem("", "x")), null, false, null, false, null),
                new ReportLayout.Frame("", slot(""), slot(""), slot(""), slot(""), slot(""), slot(""), Collections.nCopies(17, new ReportLayout.InfoItem("a", "b")), null, false, null, false, null))) {
            assertThrows(IllegalArgumentException.class, () -> layout(null, bad, "LANDSCAPE").validated());
        }
        assertThrows(IllegalArgumentException.class, () -> layout(new ReportLayout.Logo(true, logo(), 5, 8, 18, "ALL", "TOP"), null, "LANDSCAPE").validated());
        // a text of five lines with the new placeholders is fine
        layout(null, new ReportLayout.Frame("ACME", slot("{{report.filters}}\n{{template.approvedBy}} {{template.approvedAt}}\n{{report.executorDepartment}}"), slot(""), slot(""), slot(""), slot(""), slot(""),
                null, null, false, null, false, null), "LANDSCAPE").validated();
    }

    /** The editor draws its click targets from these: they must be where the page is drawn and never over what they do not name. */
    @Test
    void theZonesOfAPageAreWhereThePageIsDrawn() throws Exception {
        var info = List.of(new ReportLayout.InfoItem("Rows", "{{report.rowCount}}"), new ReportLayout.InfoItem("By", "{{report.executor}}"));
        var layout = layout(new ReportLayout.Logo(true, logo(), 5, 8, 14, "ALL", "RIGHT"), frame(true, true, info), "LANDSCAPE");
        var table = ReportPresentationRenderer.zones(layout, true, false);
        var kinds = table.stream().map(ReportPresentationRenderer.Zone::kind).toList();
        assertTrue(kinds.containsAll(List.of("HEADER_LEFT", "HEADER_CENTER", "HEADER_RIGHT", "FOOTER_LEFT", "FOOTER_CENTER", "FOOTER_RIGHT", "INFO")));
        assertFalse(kinds.contains("APPROVAL") || kinds.contains("NOTES"));
        float bandTop = layout.pageHeight() - ReportPresentationRenderer.headerBandHeight(layout);
        var info0 = table.stream().filter(z -> z.kind().equals("INFO")).findFirst().orElseThrow();
        assertTrue(info0.y() + info0.height() <= bandTop + 0.01, "the information is below the header band");
        var left = table.stream().filter(z -> z.kind().equals("HEADER_LEFT")).findFirst().orElseThrow();
        var right = table.stream().filter(z -> z.kind().equals("HEADER_RIGHT")).findFirst().orElseThrow();
        assertTrue(left.x() < right.x() && right.x() + right.width() <= layout.pageWidth(), "the three places tile the width of the page");
        var closing = ReportPresentationRenderer.zones(layout, false, true);
        var closingKinds = closing.stream().map(ReportPresentationRenderer.Zone::kind).toList();
        assertTrue(closingKinds.contains("APPROVAL") && closingKinds.contains("NOTES") && !closingKinds.contains("INFO"));
        var approval = closing.stream().filter(z -> z.kind().equals("APPROVAL")).findFirst().orElseThrow();
        var notes = closing.stream().filter(z -> z.kind().equals("NOTES")).findFirst().orElseThrow();
        assertTrue(notes.y() + notes.height() <= approval.y() + 0.01, "the notes box is below the approval block");
        // nothing switched on, nothing to point at
        var plain = ReportPresentationRenderer.zones(layout(null, frame(false, false, List.of()), "PORTRAIT"), true, true).stream().map(ReportPresentationRenderer.Zone::kind).toList();
        assertFalse(plain.contains("INFO") || plain.contains("APPROVAL") || plain.contains("NOTES"));
    }

    /** A logo shown on every page is stored once in the file and used by every page (it was stored again on each page: 155 pages made 8 MB). */
    @Test
    void aLogoOnEveryPageIsStoredOnceInTheFile() throws Exception {
        var layout = layout(new ReportLayout.Logo(true, logo(), 4, 2, 16, "ALL", "LEFT"), frame(false, false, List.of()), null);
        byte[] bytes = ReportPresentationRenderer.render("PDF", rows(150), layout, values());
        try (var pdf = org.apache.pdfbox.Loader.loadPDF(bytes)) {
            assertTrue(pdf.getNumberOfPages() > 3, "several pages");
            var images = new java.util.HashSet<Object>();
            for (var page : pdf.getPages()) {
                var resources = page.getResources();
                for (var name : resources.getXObjectNames()) {
                    var object = resources.getXObject(name);
                    if (object instanceof org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject image) images.add(image.getCOSObject());
                }
            }
            assertEquals(1, images.size(), "one copy of the logo for all the pages");
        }
    }

    @Test
    void aWatermarkAndAStampOnEveryPageStoreEachFontOnceInTheFile() throws Exception {
        var layout = new ReportLayout(false, "", "", false, false, "Header text", "Footer text", true, true, "FOR REVIEW", true, "QA COPY", null, null, null, null, null, null, null, frame(false, false, List.of()));
        byte[] bytes = ReportPresentationRenderer.render("PDF", rows(150), layout, values());
        try (var pdf = org.apache.pdfbox.Loader.loadPDF(bytes)) {
            assertTrue(pdf.getNumberOfPages() > 3, "several pages");
            var fontFiles = new java.util.HashSet<Object>();
            for (var page : pdf.getPages()) {
                for (var name : page.getResources().getFontNames()) {
                    var font = page.getResources().getFont(name);
                    if (font instanceof org.apache.pdfbox.pdmodel.font.PDType0Font type0 && type0.getDescendantFont().getFontDescriptor() != null)
                        fontFiles.add(type0.getDescendantFont().getFontDescriptor().getCOSObject());
                }
            }
            assertTrue(fontFiles.size() <= 3, "a font is stored once for all the pages, found " + fontFiles.size());
        }
    }
}
