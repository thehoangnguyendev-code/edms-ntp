package com.eqms.service.report;

import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import java.awt.Color;
import java.io.IOException;

/**
 * The stamp of a report: a framed box with the text centred in it, laid out and drawn the way the stamp of a Controlled Copy is. Its text is 13 pt with a
 * padding of 0.6 of that around it. Until it is placed by hand it sits in the top right corner, 4 mm from the edges, at that size and never wider than a third
 * of the page; once placed, its left and top edges are a percentage of the page and its width is a percentage of the page width, which scales the whole box.
 * Never taller than a third of the page, and never off the page.
 *
 * @param x     left edge, in PDF points
 * @param y     bottom edge, in PDF points from the bottom of the page
 * @param scale the share of the natural size the box was drawn at
 */
public record ReportStampBox(float x, float y, float width, float height, float scale, float titleSize, float padding, String text) {
    private static final float TITLE_SIZE = 13f, POINTS_PER_MM = 72f / 25.4f, DEFAULT_MARGIN_MM = 4f;

    public static ReportStampBox layout(PDFont font, String text, ReportLayout.Stamp stamp, float pageWidth, float pageHeight) throws IOException {
        String safe = printable(font, text);
        float padding = TITLE_SIZE * 0.6f;
        float width = textWidth(font, safe, TITLE_SIZE) + padding * 2;
        float height = padding * 2 + TITLE_SIZE * 1.25f;
        boolean sized = stamp.width() != null;
        float limit = sized ? pageWidth * stamp.width().floatValue() / 100f : pageWidth / 3f;
        float scale = sized ? limit / width : Math.min(1f, limit / width);
        width *= scale;
        height *= scale;
        float heightScale = Math.min(1f, (pageHeight / 3f) / height);
        if (heightScale < 1f) {
            scale *= heightScale;
            width *= heightScale;
            height *= heightScale;
        }
        float x;
        float y;
        if (stamp.placed()) {
            x = stamp.x().floatValue() * pageWidth / 100f;
            y = pageHeight - stamp.y().floatValue() * pageHeight / 100f - height;
        } else {
            float margin = DEFAULT_MARGIN_MM * POINTS_PER_MM;
            x = pageWidth - margin - width;
            y = pageHeight - margin - height;
        }
        x = Math.max(0f, Math.min(x, pageWidth - width));
        y = Math.max(0f, Math.min(y, pageHeight - height));
        return new ReportStampBox(x, y, width, height, scale, TITLE_SIZE, padding, safe);
    }

    public void draw(PDPageContentStream content, PDFont font, ReportLayout.Stamp stamp) throws IOException {
        Color color = Color.decode(stamp.color());
        content.saveGraphicsState();
        var alpha = new PDExtendedGraphicsState();
        alpha.setNonStrokingAlphaConstant(stamp.opacity() / 100f);
        alpha.setStrokingAlphaConstant(stamp.opacity() / 100f);
        content.setGraphicsStateParameters(alpha);
        content.setStrokingColor(color);
        content.setNonStrokingColor(color);
        content.setLineWidth(1.6f * scale);
        content.addRect(x, y, width, height);
        content.stroke();
        float size = titleSize * scale;
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x + (width - textWidth(font, text, size)) / 2f, y + height - padding * scale - size);
        content.showText(text);
        content.endText();
        content.restoreGraphicsState();
    }

    private static float textWidth(PDFont font, String text, float size) throws IOException {
        return font.getStringWidth(text) / 1000f * size;
    }

    private static String printable(PDFont font, String text) {
        StringBuilder out = new StringBuilder();
        text.codePoints().forEach(codePoint -> {
            String character = new String(Character.toChars(codePoint));
            try {
                font.encode(character);
                out.append(character);
            } catch (IOException | IllegalArgumentException ex) {
                out.append('?');
            }
        });
        return out.toString();
    }
}
