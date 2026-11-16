package com.eqms.service.report;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.util.Matrix;
import java.awt.Color;
import java.util.HashMap;
import java.util.Map;

/**
 * Draws a text of the report with its style (REPORT-TEXT-STYLE-2026-11-14). One instance serves one PDF document: a font file is embedded once however many texts use it.
 * A text with no style is drawn with the font of the report exactly as before. A family that has no italic file (Oswald) is slanted by the text matrix.
 */
final class ReportStyledText {
    /** A text measured: the font it is drawn with, the characters, the size after it was shrunk to fit, and its width in points. */
    record Fit(PDType0Font font, String text, float size, float width, boolean slant) {}

    private static final float SLANT = 0.2f;
    private final PDDocument pdf;
    private final PDType0Font base;
    private final String reportFont;
    private final Map<String, PDType0Font> cache = new HashMap<>();

    ReportStyledText(PDDocument pdf, PDType0Font base, String reportFont) {
        this.pdf = pdf;
        this.base = base;
        this.reportFont = reportFont == null ? "NOTO_SANS" : reportFont;
    }

    PDDocument pdf() { return pdf; }

    /** The bundled file for the style: the font of the report when the style sets no font, bold or italic. */
    PDType0Font font(ReportTextStyle style) throws Exception {
        if (style == null || (style.font() == null && style.bold() == null && !Boolean.TRUE.equals(style.italic()))) return base;
        String key = style.effectiveFont(reportFont);
        boolean bold = style.bold() != null ? style.bold() : ReportFonts.legacyBold(key);
        String resource = ReportFonts.styledResource(key, bold, Boolean.TRUE.equals(style.italic()));
        var loaded = cache.get(resource);
        if (loaded == null) {
            try (var input = ReportStyledText.class.getResourceAsStream(resource)) {
                loaded = PDType0Font.load(pdf, input);
            }
            cache.put(resource, loaded);
        }
        return loaded;
    }

    /** Measures a text and shrinks it to fit the room it has; a control character is a space. */
    Fit fit(ReportTextStyle style, String text, float size, float maxWidth) throws Exception {
        text = text.replaceAll("[\\p{Cc}]", " ");
        if (style != null) text = style.apply(text);
        var font = font(style);
        float natural = font.getStringWidth(text) / 1000;
        float actual = Math.min(size, natural == 0 ? size : maxWidth / natural);
        boolean slant = style != null && Boolean.TRUE.equals(style.italic()) && !ReportFonts.hasItalic(style.effectiveFont(reportFont));
        return new Fit(font, text, actual, natural * actual, slant);
    }

    /** The left edge of a text of the given width inside a box, by the alignment of the style (left when none). */
    static float alignedX(ReportTextStyle style, float x, float boxWidth, float width) {
        String align = style == null ? "LEFT" : style.effectiveAlign("LEFT");
        return switch (align) {
            case "CENTER" -> x + (boxWidth - width) / 2;
            case "RIGHT" -> x + boxWidth - width;
            default -> x;
        };
    }

    /** Draws a measured text with its colour (the style's, or the fallback) and its underline. */
    void draw(PDPageContentStream stream, ReportTextStyle style, Fit fit, float x, float y, Color fallback) throws Exception {
        Color color = style != null && style.color() != null ? Color.decode(style.color()) : fallback;
        stream.setNonStrokingColor(color);
        stream.beginText();
        stream.setFont(fit.font(), fit.size());
        if (fit.slant()) stream.setTextMatrix(new Matrix(1, 0, SLANT, 1, x, y)); else stream.newLineAtOffset(x, y);
        stream.showText(fit.text());
        stream.endText();
        if (style != null && Boolean.TRUE.equals(style.underline()) && fit.width() > 0) {
            stream.saveGraphicsState();
            stream.setStrokingColor(color);
            stream.setLineWidth(Math.max(0.4f, fit.size() * 0.06f));
            stream.moveTo(x, y - fit.size() * 0.15f);
            stream.lineTo(x + fit.width(), y - fit.size() * 0.15f);
            stream.stroke();
            stream.restoreGraphicsState();
        }
    }

    /** Measures and draws a text in a box: aligned by the style, shrunk to fit. */
    void drawIn(PDPageContentStream stream, ReportTextStyle style, String text, float x, float y, float size, float boxWidth, Color fallback) throws Exception {
        var fit = fit(style, text, size, boxWidth);
        draw(stream, style, fit, alignedX(style, x, boxWidth, fit.width()), y, fallback);
    }
}
