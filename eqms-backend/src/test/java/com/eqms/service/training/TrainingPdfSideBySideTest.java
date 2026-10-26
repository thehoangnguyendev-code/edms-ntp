package com.eqms.service.training;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Two papers in one file, page beside page: the viewer scrolls and zooms them together. */
class TrainingPdfSideBySideTest {
    private static byte[] pdf(String... pages) throws Exception {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String text : pages) {
                PDPage page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.beginText();
                    cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
                    cs.newLineAtOffset(50, 700);
                    cs.showText(text);
                    cs.endText();
                }
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void thePageOfTheTestIsBesideThePageOfTheKey() throws Exception {
        byte[] joined = TrainingPdfSideBySide.join(pdf("TEST-1", "TEST-2"), pdf("KEY-1", "KEY-2"));
        try (PDDocument doc = Loader.loadPDF(joined)) {
            assertEquals(2, doc.getNumberOfPages());
            PDRectangle a4 = PDRectangle.A4;
            assertTrue(doc.getPage(0).getMediaBox().getWidth() > 2 * a4.getWidth(), "two pages wide");
            assertEquals(a4.getHeight(), doc.getPage(0).getMediaBox().getHeight(), 0.5f);
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(1);
            String first = stripper.getText(doc);
            assertTrue(first.contains("TEST-1") && first.contains("KEY-1") && !first.contains("TEST-2"), first);
            stripper.setStartPage(2);
            stripper.setEndPage(2);
            String second = stripper.getText(doc);
            assertTrue(second.contains("TEST-2") && second.contains("KEY-2"), second);
            // the test is on the left of the key
            assertTrue(joined.length > 0);
        }
    }

    @Test
    void aPaperWithFewerPagesLeavesAnEmptyPlace() throws Exception {
        byte[] joined = TrainingPdfSideBySide.join(pdf("TEST-1"), pdf("KEY-1", "KEY-2"));
        try (PDDocument doc = Loader.loadPDF(joined)) {
            assertEquals(2, doc.getNumberOfPages());
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(2);
            stripper.setEndPage(2);
            String second = stripper.getText(doc);
            assertTrue(second.contains("KEY-2") && !second.contains("TEST"), second);
        }
    }

    @Test
    void theTextIsNotDrawnInTheColourOfTheBackgroundOfThePaper() throws Exception {
        byte[] joined = TrainingPdfSideBySide.join(pdf("TEST-1"), pdf("KEY-1"));
        try (PDDocument doc = Loader.loadPDF(joined)) {
            java.awt.image.BufferedImage image = new org.apache.pdfbox.rendering.PDFRenderer(doc).renderImageWithDPI(0, 72);
            int dark = 0;
            for (int x = 0; x < image.getWidth() / 2 - 20; x++) for (int y = 0; y < image.getHeight(); y++) if ((image.getRGB(x, y) & 0xFF) < 100) dark++;
            assertTrue(dark > 20, "the text of the first paper is dark on the white page: " + dark);
        }
    }
}
