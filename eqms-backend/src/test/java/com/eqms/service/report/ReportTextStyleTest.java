package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.apache.pdfbox.Loader;
import org.junit.jupiter.api.Test;

/** The text styles of a report (REPORT-TEXT-STYLE-2026-11-14): checked against fixed lists, drawn with the bundled fonts, and a layout with none is drawn as before. */
class ReportTextStyleTest {
    private static ReportLayout.Slot styled(String text, ReportTextStyle style) { return new ReportLayout.Slot(text, null, style); }

    private static ReportLayout layoutWith(String fontFamily, ReportTextStyle style) {
        var plain = new ReportLayout.Slot("", null);
        var frame = new ReportLayout.Frame("ACME", styled("{{report.title}}", style), plain, styled("Right text", style), styled("{{company.name}}", style), plain, plain,
                List.of(new ReportLayout.InfoItem("Prepared by", "{{report.executor}}")), 2, true, null, true, 100, style, style, style, style);
        return new ReportLayout(true, "{{report.title}}", "Sub", true, true, "h", "f", true, false, "x", false, "x", null, null, null, null, "LANDSCAPE", null, fontFamily, frame, style, style);
    }

    private static byte[] render(ReportLayout layout) throws Exception {
        return ReportPresentationRenderer.render("PDF", ReportPageFrameTest.rows(3), layout, ReportPageFrameTest.values());
    }

    @Test
    void everyFamilyDrawsInEveryWeightAndSlantWithTheBundledFiles() throws Exception {
        for (String font : ReportFonts.KEYS) {
            for (boolean bold : new boolean[] { false, true }) {
                for (boolean italic : new boolean[] { false, true }) {
                    var style = new ReportTextStyle(font, 12, "#1d4ed8", bold, italic, true, "CENTER");
                    byte[] pdf = render(layoutWith("NOTO_SANS", style).validated());
                    try (var document = Loader.loadPDF(pdf)) { assertTrue(document.getNumberOfPages() >= 3, font + " bold=" + bold + " italic=" + italic); }
                    assertTrue(ReportFonts.class.getResource(ReportFonts.styledResource(font, bold, italic)) != null, "file for " + font + " " + bold + " " + italic);
                }
            }
        }
    }

    @Test
    void aStyledReportKeepsItsTextAndAnUnstyledOneIsDrawnAsBefore() throws Exception {
        String styled = ReportPageFrameTest.text(render(layoutWith("TIMES_NEW_ROMAN", new ReportTextStyle(null, null, "#b91c1c", null, true, null, null)).validated()), 2);
        assertTrue(styled.contains("Due for review") && styled.contains("Prepared by"), styled);
        var none = layoutWith(null, null);
        assertTrue(none.coverTitleStyle() == null && none.effectiveFrame().infoLabelStyle() == null);
        assertTrue(ReportPageFrameTest.text(render(none.validated()), 2).contains("Due for review"));
    }

    @Test
    void aStyleThatIsNotInTheFixedListsIsRefused() {
        for (var bad : List.of(new ReportTextStyle("COMIC_SANS", null, null, null, null, null, null), new ReportTextStyle(null, 5, null, null, null, null, null),
                new ReportTextStyle(null, 49, null, null, null, null, null), new ReportTextStyle(null, null, "red", null, null, null, null), new ReportTextStyle(null, null, "#12345", null, null, null, null),
                new ReportTextStyle(null, null, null, null, null, null, "JUSTIFY"))) {
            assertThrows(IllegalArgumentException.class, () -> layoutWith(null, bad).validated(), bad.toString());
        }
        assertDoesNotThrow(() -> layoutWith(null, new ReportTextStyle("OSWALD", 48, "#0A0B0C", true, true, true, "RIGHT")).validated());
    }

    @Test
    void aTextIsPrintedInUpperLowerOrCapitalLettersAndAnUnknownTransformIsRefused() throws Exception {
        assertEquals("ĐÃ DUYỆT REPORT", new ReportTextStyle(null, null, null, null, null, null, null, "UPPERCASE").apply("đã duyệt report"));
        assertEquals("đã duyệt report", new ReportTextStyle(null, null, null, null, null, null, null, "LOWERCASE").apply("ĐÃ DUYỆT Report"));
        assertEquals("Đã Duyệt Report", new ReportTextStyle(null, null, null, null, null, null, null, "CAPITALIZE").apply("đã duyệt report"));
        assertEquals("as written", new ReportTextStyle(null, null, null, null, null, null, null, null).apply("as written"));
        assertThrows(IllegalArgumentException.class, () -> layoutWith(null, new ReportTextStyle(null, null, null, null, null, null, null, "SHOUT")).validated());
        String upper = ReportPageFrameTest.text(render(layoutWith(null, new ReportTextStyle(null, null, null, null, null, null, null, "UPPERCASE")).validated()), 2);
        assertTrue(upper.contains("DUE FOR REVIEW") && upper.contains("PREPARED BY"), upper);
    }

    @Test
    void aPlaceOfTheHeaderOrFooterSwitchedOffPrintsNothingAndKeepsItsText() throws Exception {
        var on = new ReportLayout.Slot("Secret left text", null, null, null);
        var off = new ReportLayout.Slot("Secret left text", null, null, false);
        assertEquals("Secret left text", on.effectiveText());
        assertEquals("", off.effectiveText());
        assertEquals("Secret left text", off.text());
        var plain = new ReportLayout.Slot("", null);
        var frame = new ReportLayout.Frame("ACME", off, plain, plain, off, plain, plain, List.of(), 2, false, null, false, 100);
        var layout = new ReportLayout(false, "", "", false, false, "h", "f", false, false, "x", false, "x", null, null, null, null, "LANDSCAPE", null, null, frame);
        assertFalse(ReportPageFrameTest.text(ReportPresentationRenderer.render("PDF", ReportPageFrameTest.rows(3), layout.validated(), ReportPageFrameTest.values()), 1).contains("Secret left text"));
    }

    @Test
    void theColumnsOfTheApprovalTableAreNamedAndCanBeSwitchedOff() throws Exception {
        var plain = new ReportLayout.Slot("", null);
        var columns = List.of(new ReportLayout.ApprovalColumn("Position", null), new ReportLayout.ApprovalColumn("Designation", false), new ReportLayout.ApprovalColumn("Stamp", true));
        var frame = new ReportLayout.Frame("", plain, plain, plain, plain, plain, plain, List.of(), 2, true, null, false, 100, null, null, null, null, columns);
        var layout = new ReportLayout(false, "", "", false, false, "h", "f", false, false, "x", false, "x", null, null, null, null, "LANDSCAPE", null, null, frame);
        assertEquals(List.of("Position", "Stamp"), frame.shownApprovalColumns().stream().map(ReportLayout.ApprovalColumn::label).toList());
        float[] widths = ReportPageFrame.approvalWidths(frame);
        assertEquals(3, widths.length);
        assertEquals(1f, widths[0] + widths[1] + widths[2], 0.001f);
        String last = ReportPageFrameTest.text(ReportPresentationRenderer.render("PDF", ReportPageFrameTest.rows(3), layout.validated(), ReportPageFrameTest.values()), 2);
        assertTrue(last.contains("Position") && last.contains("Stamp") && !last.contains("Designation"), last);
        assertEquals(4, ReportLayout.ApprovalColumn.DEFAULTS.size());
        assertEquals("RIGHT", new ReportLayout.ApprovalColumn("x", null, "RIGHT").effectiveAlign());
        assertEquals("LEFT", new ReportLayout.ApprovalColumn("x", null).effectiveAlign());
        assertThrows(IllegalArgumentException.class, () -> new ReportLayout.ApprovalColumn("x", null, "MIDDLE").validated());
        var seven = Collections.nCopies(7, new ReportLayout.ApprovalColumn("x", null));
        assertThrows(IllegalArgumentException.class, () -> new ReportLayout(false, "", "", false, false, "h", "f", false, false, "x", false, "x", null, null, null, null, "LANDSCAPE", null, null,
                new ReportLayout.Frame("", plain, plain, plain, plain, plain, plain, List.of(), 2, true, null, false, 100, null, null, null, null, seven)).validated());
    }

    @Test
    void aTextWithoutABoldSettingKeepsTheWeightTheReportAlwaysHad() {
        assertTrue(ReportFonts.legacyBold("NOTO_SANS") && ReportFonts.legacyBold("OSWALD"));
        assertFalse(ReportFonts.legacyBold("TIMES_NEW_ROMAN"));
        assertFalse(ReportFonts.hasItalic("OSWALD"));
        assertEquals("/fonts/Tinos-BoldItalic.ttf", ReportFonts.styledResource("TIMES_NEW_ROMAN", true, true));
        assertEquals("/fonts/Oswald-Bold.ttf", ReportFonts.styledResource("OSWALD", true, true));
    }
}
