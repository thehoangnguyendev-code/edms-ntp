package com.eqms;

import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The stamp and watermark burned into an issued Controlled Copy: content, position on rotated pages, and safety. */
class ControlledCopyPdfMarkingServiceTest {

    private final ControlledCopyPdfMarkingService service = new ControlledCopyPdfMarkingService();
    private final ObjectMapper mapper = new ObjectMapper();

    private static byte[] pdf(int pages, int rotation, PDRectangle size) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) {
                PDPage page = new PDPage(size);
                page.setRotation(rotation);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.newLineAtOffset(100, 400);
                    content.showText("ORIGINAL BODY PAGE " + (i + 1));
                    content.endText();
                }
            }
            document.save(out);
            return out.toByteArray();
        }
    }

    private ControlledCopyRecord copy() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        copy.setValidUntil(LocalDate.of(2027, 3, 31));
        return copy;
    }

    private com.fasterxml.jackson.databind.JsonNode recipient(String name) {
        return mapper.createObjectNode().put("name", name);
    }

    private static String text(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    /** Positions of the stamp title glyphs in DISPLAYED coordinates (origin top-left), pages as displayed. */
    private static float[] stampPosition(byte[] pdf, int pageIndex) throws IOException {
        List<float[]> found = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper() {
                @Override
                protected void writeString(String string, List<TextPosition> positions) {
                    if (string.contains("CONTROLLED")) {
                        TextPosition first = positions.get(0);
                        found.add(new float[] {first.getXDirAdj(), first.getYDirAdj(), first.getPageWidth(), first.getPageHeight()});
                    }
                }
            };
            stripper.setStartPage(pageIndex + 1);
            stripper.setEndPage(pageIndex + 1);
            stripper.getText(document);
        }
        assertFalse(found.isEmpty(), "stamp text not found on page " + (pageIndex + 1));
        return found.get(0);
    }

    @Test
    void stampAndWatermark_areBurnedIn_andOriginalContentIsPreserved() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        // the defaults are a compact stamp; ask for every line so the content is checked too
        policy.setStampShowRecipient(true);
        policy.setStampShowExpiryDate(true);
        policy.setWatermarkRecipient(true);
        byte[] marked = service.apply(pdf(2, 0, PDRectangle.A4), copy(), recipient("Trần Văn Ánh"), policy);

        String text = text(marked);
        assertTrue(text.contains("ORIGINAL BODY PAGE 1"));
        assertTrue(text.contains("ORIGINAL BODY PAGE 2"));
        assertTrue(text.contains("CONTROLLED COPY"));
        assertTrue(text.contains("No. CC.SOP.0001.003"));
        assertTrue(text.contains("Valid until 31/03/2027"));
        // Vietnamese diacritics render through the bundled Unicode font
        assertTrue(text.contains("Trần Văn Ánh"), text);
        // every page is marked
        try (PDDocument document = Loader.loadPDF(marked)) {
            assertEquals(2, document.getNumberOfPages());
        }
        assertEquals(2, occurrences(text, "No. CC.SOP.0001.003"));
    }

    @Test
    void stampOnFirstPageOnly_whenConfigured() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setStampPages("FIRST");
        policy.setWatermarkEnabled(false);

        String text = text(service.apply(pdf(3, 0, PDRectangle.A4), copy(), recipient("A"), policy));

        assertEquals(1, occurrences(text, "CONTROLLED COPY"));
    }

    @Test
    void disabledStampAndWatermark_reportNotEnabled() {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setStampEnabled(false);
        policy.setWatermarkEnabled(false);
        assertFalse(service.isMarkingEnabled(policy));
    }

    @Test
    void stampStaysInTheChosenDisplayedCorner_onRotatedPages() throws IOException {
        for (int rotation : new int[] {0, 90, 180, 270}) {
            ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
            policy.setWatermarkEnabled(false);
            policy.setStampPosition("TOP_RIGHT");

            byte[] marked = service.apply(pdf(1, rotation, PDRectangle.A4), copy(), recipient("A"), policy);
            float[] position = stampPosition(marked, 0);

            // TextPosition reports the unrotated page size; the reader sees the page turned
            boolean turned = rotation == 90 || rotation == 270;
            float pageWidth = turned ? position[3] : position[2];
            float pageHeight = turned ? position[2] : position[3];
            assertTrue(position[0] > pageWidth / 2, "rotation " + rotation + ": stamp should be in the right half, x=" + position[0] + " of " + pageWidth);
            assertTrue(position[1] < pageHeight / 3, "rotation " + rotation + ": stamp should be near the top, y=" + position[1] + " of " + pageHeight);
        }
    }

    @Test
    void watermark_isCentredAndFullyInsideThePage_atEveryRotation() throws IOException {
        for (int rotation : new int[] {0, 90, 180, 270}) {
            ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
            policy.setStampEnabled(false);
            byte[] marked = service.apply(pdf(1, rotation, PDRectangle.A4), copy(), recipient("A"), policy);

            List<float[]> glyphs = new ArrayList<>();
            try (PDDocument document = Loader.loadPDF(marked)) {
                PDFTextStripper stripper = new PDFTextStripper() {
                    @Override
                    protected void writeString(String string, List<TextPosition> positions) {
                        for (TextPosition position : positions) {
                            // the watermark title is the only large text on the page
                            if (position.getFontSizeInPt() > 30) {
                                glyphs.add(new float[] {position.getXDirAdj(), position.getYDirAdj(), position.getPageWidth(), position.getPageHeight()});
                            }
                        }
                    }
                };
                stripper.getText(document);
            }
            assertFalse(glyphs.isEmpty(), "watermark title not found, rotation " + rotation);
            boolean turned = rotation == 90 || rotation == 270;
            float width = turned ? glyphs.get(0)[3] : glyphs.get(0)[2];
            float height = turned ? glyphs.get(0)[2] : glyphs.get(0)[3];
            float minX = Float.MAX_VALUE, maxX = -Float.MAX_VALUE, minY = Float.MAX_VALUE, maxY = -Float.MAX_VALUE;
            for (float[] glyph : glyphs) {
                minX = Math.min(minX, glyph[0]);
                maxX = Math.max(maxX, glyph[0]);
                minY = Math.min(minY, glyph[1]);
                maxY = Math.max(maxY, glyph[1]);
            }
            assertTrue(minX >= 0 && maxX <= width && minY >= 0 && maxY <= height,
                    "rotation " + rotation + ": watermark outside the page: x " + minX + ".." + maxX + " of " + width + ", y " + minY + ".." + maxY + " of " + height);
            float centreX = (minX + maxX) / 2f;
            float centreY = (minY + maxY) / 2f;
            assertTrue(Math.abs(centreX - width / 2f) < width * 0.12f, "rotation " + rotation + ": not centred horizontally: " + centreX + " of " + width);
            assertTrue(Math.abs(centreY - height / 2f) < height * 0.12f, "rotation " + rotation + ": not centred vertically: " + centreY + " of " + height);
        }
    }

    @Test
    void statusWatermark_isDrawnOnEveryPage_withoutTouchingTheOriginalContent() throws IOException {
        byte[] original = pdf(3, 0, PDRectangle.A4);

        byte[] withStatus = service.applyStatusWatermark(original, List.of("RECALLED BY DOCUMENT CONTROL", "Withdrawn 26/09/2026"));

        String text = text(withStatus);
        assertEquals(3, occurrences(text, "RECALLED BY DOCUMENT CONTROL"));
        assertTrue(text.contains("ORIGINAL BODY PAGE 3"));
        // the input bytes are untouched (a view never changes the stored file)
        assertFalse(text(original).contains("RECALLED"));
    }

    @Test
    void watermark_isDrawnBehindThePageContent() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setStampEnabled(false);

        String text = text(service.apply(pdf(1, 0, PDRectangle.A4), copy(), recipient("A"), policy));

        // text is extracted in drawing order: the watermark comes first, the document's own text after it
        assertTrue(text.indexOf("CONTROLLED COPY") >= 0 && text.indexOf("ORIGINAL BODY PAGE 1") > text.indexOf("CONTROLLED COPY"), text);
    }

    @Test
    void defaultWatermark_carriesOnlyTheTitleAndTheCopyNumber() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setStampEnabled(false);

        String text = text(service.apply(pdf(1, 0, PDRectangle.A4), copy(), recipient("Tran Van A"), policy));

        assertTrue(text.contains("CC.SOP.0001.003"));
        assertFalse(text.contains("Tran Van A"));
        assertFalse(text.contains("Expires"));
        assertFalse(text.contains("Distributed"));
    }

    @Test
    void stampDistanceFromTheEdge_isConfigurable() throws IOException {
        ControlledCopyPolicySetting near = new ControlledCopyPolicySetting();
        near.setWatermarkEnabled(false);
        near.setStampMarginMm(2);
        ControlledCopyPolicySetting far = new ControlledCopyPolicySetting();
        far.setWatermarkEnabled(false);
        far.setStampMarginMm(30);

        float[] nearPosition = stampPosition(service.apply(pdf(1, 0, PDRectangle.A4), copy(), recipient("A"), near), 0);
        float[] farPosition = stampPosition(service.apply(pdf(1, 0, PDRectangle.A4), copy(), recipient("A"), far), 0);

        // top-right stamp: a larger distance moves it left and down
        assertTrue(farPosition[0] < nearPosition[0]);
        assertTrue(farPosition[1] > nearPosition[1]);
    }

    @Test
    void bottomLeftStamp_onLandscapePage() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setWatermarkEnabled(false);
        policy.setStampPosition("BOTTOM_LEFT");

        float[] position = stampPosition(service.apply(pdf(1, 0, new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth())),
                copy(), recipient("A"), policy), 0);

        assertTrue(position[0] < position[2] / 2);
        assertTrue(position[1] > position[3] * 2 / 3);
    }

    @Test
    void unencodableCharacters_neverBreakIssuingACopy() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();

        byte[] marked = service.apply(pdf(1, 0, PDRectangle.A4), copy(), recipient("山田 太郎 😀"), policy);

        assertTrue(text(marked).contains("CONTROLLED COPY"));
    }

    @Test
    void emptyPdf_isRejected() {
        assertThrows(IllegalStateException.class,
                () -> service.apply(new byte[0], copy(), recipient("A"), new ControlledCopyPolicySetting()));
    }

    private static int occurrences(String text, String needle) {
        int count = 0;
        int index = 0;
        while ((index = text.indexOf(needle, index)) >= 0) {
            count++;
            index += needle.length();
        }
        return count;
    }
}
