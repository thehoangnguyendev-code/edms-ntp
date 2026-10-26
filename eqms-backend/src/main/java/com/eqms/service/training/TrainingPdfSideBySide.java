package com.eqms.service.training;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.multipdf.LayerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.util.Matrix;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Two PDFs in one: page 1 of the first beside page 1 of the second, then page 2 beside page 2, and so on. The viewer then shows one file, so that scrolling and zooming apply to both papers at the
 * same time. A paper that has fewer pages leaves an empty place. Nothing is stored; the sources are not changed.
 */
final class TrainingPdfSideBySide {
    /** The space between the two papers, wide enough to see at a glance where one ends and the other begins. */
    private static final float GAP = 44f;
    private static final Color BACKGROUND = new Color(0.88f, 0.89f, 0.92f);
    private static final PDRectangle A4 = PDRectangle.A4;

    private TrainingPdfSideBySide() {
    }

    static byte[] join(byte[] left, byte[] right) {
        try (PDDocument a = Loader.loadPDF(left); PDDocument b = Loader.loadPDF(right); PDDocument out = new PDDocument(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            LayerUtility layers = new LayerUtility(out);
            int pages = Math.max(a.getNumberOfPages(), b.getNumberOfPages());
            for (int i = 0; i < pages; i++) {
                boolean hasA = i < a.getNumberOfPages(), hasB = i < b.getNumberOfPages();
                PDRectangle ra = hasA ? a.getPage(i).getMediaBox() : hasB ? b.getPage(i).getMediaBox() : A4;
                PDRectangle rb = hasB ? b.getPage(i).getMediaBox() : ra;
                float width = ra.getWidth() + GAP + rb.getWidth();
                float height = Math.max(ra.getHeight(), rb.getHeight());
                PDPage page = new PDPage(new PDRectangle(width, height));
                out.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(out, page)) {
                    // the sheet is grey and each paper is a white page on it, so the gap between them is seen; the colours are put back before the papers are drawn (a text that does not set its
                    // own colour is drawn in the colour that is current: white on white would be invisible)
                    cs.saveGraphicsState();
                    cs.setNonStrokingColor(BACKGROUND);
                    cs.addRect(0, 0, width, height);
                    cs.fill();
                    cs.setNonStrokingColor(Color.WHITE);
                    if (hasA) { cs.addRect(0, height - ra.getHeight(), ra.getWidth(), ra.getHeight()); cs.fill(); }
                    if (hasB) { cs.addRect(ra.getWidth() + GAP, height - rb.getHeight(), rb.getWidth(), rb.getHeight()); cs.fill(); }
                    cs.restoreGraphicsState();
                    if (hasA) draw(cs, layers.importPageAsForm(a, i), 0, height - ra.getHeight());
                    if (hasB) draw(cs, layers.importPageAsForm(b, i), ra.getWidth() + GAP, height - rb.getHeight());
                }
            }
            out.save(bytes);
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    private static void draw(PDPageContentStream cs, PDFormXObject form, float x, float y) throws IOException {
        cs.saveGraphicsState();
        cs.transform(Matrix.getTranslateInstance(x, y));
        cs.drawForm(form);
        cs.restoreGraphicsState();
    }
}
