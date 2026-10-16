package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

/** The stamp of a report is laid out as the stamp of a Controlled Copy: a framed box, top right until it is placed, scaled by its width once it is. */
class ReportStampTest {
    private static final float W = 842, H = 595;

    private PDType0Font font(PDDocument document) throws Exception {
        try (var input = ReportStampTest.class.getResourceAsStream(ReportFonts.markResource("NOTO_SANS"))) {
            return PDType0Font.load(document, input);
        }
    }

    private ReportLayout.Stamp stamp(Double x, Double y, Double width) {
        return new ReportLayout.Stamp("#059669", 90, x, y, width, "ALL", "NOTO_SANS");
    }

    @Test
    void unplacedStampSitsInTheTopRightCornerAtNaturalSize() throws Exception {
        try (var document = new PDDocument()) {
            var box = ReportStampBox.layout(font(document), "CONTROLLED", stamp(null, null, null), W, H);
            float margin = 4f * 72f / 25.4f;
            assertEquals(W - margin, box.x() + box.width(), 0.01f);
            assertEquals(H - margin, box.y() + box.height(), 0.01f);
            assertEquals(1f, box.scale(), 0.0001f);
        }
    }

    @Test
    void placedStampTakesItsLeftTopAndWidthFromPercentages() throws Exception {
        try (var document = new PDDocument()) {
            var box = ReportStampBox.layout(font(document), "CONTROLLED", stamp(10.0, 20.0, 30.0), W, H);
            assertEquals(W * 0.10f, box.x(), 0.01f);
            assertEquals(W * 0.30f, box.width(), 0.01f);
            assertEquals(H - H * 0.20f, box.y() + box.height(), 0.01f);
        }
    }

    @Test
    void stampNeverLeavesThePage() throws Exception {
        try (var document = new PDDocument()) {
            var box = ReportStampBox.layout(font(document), "CONTROLLED", stamp(99.0, 99.0, 30.0), W, H);
            assertTrue(box.x() + box.width() <= W + 0.01f);
            assertTrue(box.y() >= 0f);
        }
    }

    @Test
    void stampIsDrawnOnTheFirstPageOnlyWhenItSaysSo() throws Exception {
        var rows = new java.util.ArrayList<List<String>>();
        rows.add(List.of("Name"));
        for (int i = 0; i < 80; i++) rows.add(List.of("Row " + i));
        var values = Map.of("report.title", "T", "report.code", "C", "template.version", "1", "report.executor", "U", "report.generatedAt", "now", "report.asOfAt", "now");
        for (String pages : List.of("ALL", "FIRST")) {
            var layout = new ReportLayout(false, "T", "", false, false, "", "", false, false, "x", true, "STAMPCHECK", null,
                    new ReportLayout.Stamp("#059669", 90, null, null, null, pages, "NOTO_SANS"), null, null, "PORTRAIT").validated();
            byte[] pdf = ReportPresentationRenderer.render("PDF", rows, layout, values);
            try (var document = Loader.loadPDF(pdf)) {
                assertTrue(document.getNumberOfPages() > 1);
                int pagesWithStamp = 0;
                for (int page = 1; page <= document.getNumberOfPages(); page++) {
                    var stripper = new PDFTextStripper();
                    stripper.setStartPage(page);
                    stripper.setEndPage(page);
                    if (stripper.getText(document).contains("STAMPCHECK")) pagesWithStamp++;
                }
                assertEquals("ALL".equals(pages) ? document.getNumberOfPages() : 1, pagesWithStamp);
            }
        }
    }

    @Test
    void stampValuesAreChecked() {
        assertThrows(IllegalArgumentException.class, () -> stamp(10.0, null, null).validated());
        assertThrows(IllegalArgumentException.class, () -> stamp(10.0, 10.0, 2.0).validated());
        assertThrows(IllegalArgumentException.class, () -> stamp(101.0, 10.0, null).validated());
        assertThrows(IllegalArgumentException.class, () -> new ReportLayout.Stamp("#059669", 20, null, null, null, "ALL", "NOTO_SANS").validated());
        assertThrows(IllegalArgumentException.class, () -> new ReportLayout.Stamp("#059669", 90, null, null, null, "ALL", "COMIC").validated());
        assertDoesNotThrow(() -> stamp(null, null, null).validated());
        assertDoesNotThrow(() -> stamp(10.0, 20.0, 30.0).validated());
    }
}
