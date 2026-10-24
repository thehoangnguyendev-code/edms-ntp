package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The transient watermark overlaid on a document preview. Document Details and the Revision screen both call this, so the
 * two previews cannot drift apart. What is shown is set on the Documents configuration (Preview File tab): the main text,
 * its strength and colour, whether it repeats as a grid, and the viewer's name and employee code on one line.
 * The stored PDF is never changed; this only shapes the bytes of one preview response, which is not saved.
 */
public final class PreviewWatermark {

    /** Who is viewing and when, for this one preview response. Blank values are left off the page. */
    public record Context(String viewerName, String viewerCode, Instant openedAt) {
    }

    static final String DEFAULT_TEXT = "FOR PREVIEW ONLY";
    static final String DEFAULT_COLOR = "#B3B3F5";
    static final int MAX_TEXT = 120;
    private static final ZoneId SYSTEM_ZONE = DateTimeFormatUtils.ZONE;
    private static final DateTimeFormatter OPENED_AT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(SYSTEM_ZONE);

    /** One large watermark, centred, as it has always been drawn. */
    private static final float SINGLE_SIZE = 76f;
    /** The repeated grid uses a smaller main text so that many copies fit a page. */
    private static final float TILE_SIZE = 30f;
    private static final float TILE_STEP_X = 420f;
    private static final float TILE_STEP_Y = 240f;
    /** Copies whose centre falls this far outside the page are skipped; they could not show on it anyway. */
    private static final float EDGE = 60f;

    private PreviewWatermark() {
    }

    /** Opacity of the watermark. Light is for a document that may be read on screen freely; strong for one that must not be photographed. */
    static float alphaFor(String strength) {
        return switch (strength == null ? "standard" : strength.trim().toLowerCase(Locale.ROOT)) {
            case "light" -> 0.10f;
            case "strong" -> 0.30f;
            default -> 0.18f;
        };
    }

    /**
     * The colour as the red, green and blue fractions PDF expects. A missing or malformed value falls back to the default,
     * so a bad setting never stops a preview from opening.
     */
    static float[] rgbFor(String hex) {
        String value = hex == null ? DEFAULT_COLOR : hex.trim();
        if (!value.matches("^#[0-9A-Fa-f]{6}$")) {
            value = DEFAULT_COLOR;
        }
        int red = Integer.parseInt(value.substring(1, 3), 16);
        int green = Integer.parseInt(value.substring(3, 5), 16);
        int blue = Integer.parseInt(value.substring(5, 7), 16);
        return new float[] {red / 255f, green / 255f, blue / 255f};
    }

    /**
     * The lines printed for one copy of the watermark: the main text first, then the viewer's code and name on one line
     * (for example "NTP.0005 - Nguyen The Hoang"), then the opened time when it is switched on.
     */
    static List<String> linesFor(JsonNode policy, Context context) {
        String mainText = policy.path("watermarkText").asText(DEFAULT_TEXT).trim();
        if (mainText.isEmpty()) {
            mainText = DEFAULT_TEXT;
        }
        if (mainText.length() > MAX_TEXT) {
            mainText = mainText.substring(0, MAX_TEXT);
        }
        List<String> lines = new ArrayList<>();
        lines.add(mainText);

        List<String> viewer = new ArrayList<>();
        if (policy.path("watermarkShowEmployeeCode").asBoolean(false) && hasText(context.viewerCode())) {
            viewer.add(context.viewerCode().trim());
        }
        if (policy.path("watermarkShowViewerName").asBoolean(false) && hasText(context.viewerName())) {
            viewer.add(context.viewerName().trim());
        }
        if (!viewer.isEmpty()) {
            lines.add(String.join(" - ", viewer));
        }
        if (policy.path("watermarkShowOpenedAt").asBoolean(false) && context.openedAt() != null) {
            lines.add(OPENED_AT.format(context.openedAt()));
        }
        return lines;
    }

    /** Draws the watermark on every page. A null or non-PDF input is returned as it is, unchanged. */
    public static byte[] apply(byte[] pdfBytes, JsonNode policy, Context context) throws IOException {
        List<String> lines = linesFor(policy, context);
        float alpha = alphaFor(policy.path("watermarkStrength").asText("standard"));
        float[] colour = rgbFor(policy.path("watermarkColor").asText(DEFAULT_COLOR));
        boolean tiled = policy.path("watermarkTiled").asBoolean(false);
        try (PDDocument pdf = Loader.loadPDF(pdfBytes); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDType1Font mainFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            for (PDPage page : pdf.getPages()) {
                PDRectangle pageSize = page.getMediaBox();
                try (PDPageContentStream contentStream = new PDPageContentStream(
                        pdf,
                        page,
                        PDPageContentStream.AppendMode.APPEND,
                        true,
                        true
                )) {
                    PDExtendedGraphicsState graphicsState = new PDExtendedGraphicsState();
                    graphicsState.setNonStrokingAlphaConstant(alpha);
                    graphicsState.setStrokingAlphaConstant(alpha);
                    contentStream.setGraphicsStateParameters(graphicsState);
                    contentStream.setNonStrokingColor(colour[0], colour[1], colour[2]);
                    if (tiled) {
                        drawGrid(contentStream, mainFont, lines, pageSize);
                    } else {
                        drawBlock(contentStream, mainFont, lines, pageSize.getWidth() / 2f, pageSize.getHeight() / 2f, SINGLE_SIZE);
                    }
                }
            }
            pdf.save(output);
            return output.toByteArray();
        }
    }

    /**
     * Repeats the block on a lattice that is turned by the same 45 degrees as the text: the copies sit in straight rows that run
     * along the text, so every row is parallel and the spacing is even across the page.
     */
    private static void drawGrid(PDPageContentStream contentStream, PDType1Font font, List<String> lines, PDRectangle pageSize) throws IOException {
        double cos = Math.cos(Math.toRadians(45));
        double sin = Math.sin(Math.toRadians(45));
        double centreX = pageSize.getWidth() / 2d;
        double centreY = pageSize.getHeight() / 2d;
        // Along the text, and across the rows (perpendicular to it).
        double alongX = cos, alongY = sin;
        double acrossX = -sin, acrossY = cos;
        double reach = Math.hypot(pageSize.getWidth(), pageSize.getHeight()) / 2d + Math.max(TILE_STEP_X, TILE_STEP_Y);
        int alongCount = (int) Math.ceil(reach / TILE_STEP_X);
        int acrossCount = (int) Math.ceil(reach / TILE_STEP_Y);
        for (int i = -alongCount; i <= alongCount; i++) {
            for (int j = -acrossCount; j <= acrossCount; j++) {
                double x = centreX + i * TILE_STEP_X * alongX + j * TILE_STEP_Y * acrossX;
                double y = centreY + i * TILE_STEP_X * alongY + j * TILE_STEP_Y * acrossY;
                if (x < -EDGE || x > pageSize.getWidth() + EDGE || y < -EDGE || y > pageSize.getHeight() + EDGE) {
                    continue;
                }
                drawBlock(contentStream, font, lines, (float) x, (float) y, TILE_SIZE);
            }
        }
    }

    /**
     * One copy of the block, turned 45 degrees about its centre. Every line is placed on its own, at an absolute position in the
     * turned frame, so each line is centred on the same axis rather than drifting by the offset of the lines above it.
     */
    private static void drawBlock(PDPageContentStream contentStream, PDType1Font font, List<String> lines, float centreX, float centreY, float mainSize) throws IOException {
        double cos = Math.cos(Math.toRadians(45));
        double sin = Math.sin(Math.toRadians(45));
        float detailSize = detailSizeFor(mainSize);
        float lineGap = detailSize * 1.5f;
        // Local (along the text, across it) position of each line; the block's centre is the origin.
        float mainOffsetAcross = (lines.size() - 1) * lineGap / 2f;
        for (int line = 0; line < lines.size(); line++) {
            String text = lines.get(line);
            float size = line == 0 ? mainSize : detailSize;
            float along = -(font.getStringWidth(text) / 1000f) * size / 2f;
            float across = line == 0 ? mainOffsetAcross : mainOffsetAcross - line * lineGap;
            // Rotate the local point into page space and move it to the centre.
            double x = centreX + along * cos - across * sin;
            double y = centreY + along * sin + across * cos;
            contentStream.beginText();
            contentStream.setFont(font, size);
            contentStream.setTextMatrix(new Matrix((float) cos, (float) sin, (float) -sin, (float) cos, (float) x, (float) y));
            contentStream.showText(text);
            contentStream.endText();
        }
    }

    /** Detail lines are a clear share of the main text, and never smaller than a readable 12pt. */
    static float detailSizeFor(float mainSize) {
        return Math.max(12f, mainSize * 0.3f);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
