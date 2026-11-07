package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferByte;
import java.awt.image.IndexColorModel;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.Set;

/**
 * The traceability watermark of the read-only OnlyOffice viewer (Settings > Configuration > Preview File > OnlyOffice Preview). It is the PDF preview watermark
 * ({@link PreviewWatermark}) drawn the same way: the same settings, the same lines (the text, the viewer's code and name on one line, the time the preview was opened),
 * the same block turned by the same angle about its centre, the same lattice for the grid, the same strength and colour. The server makes it at each opening from the
 * signed-in user and the server clock.
 * <p>
 * The Document Server draws one shape per page (its {@code document.options.watermark_on_draw}). The shape is filled with a transparent picture of the watermark, drawn
 * here, so the layout is the layout of the PDF and not what the editor would make of repeated text. The stored file is never changed and the editors do not save it.
 */
public final class OnlyOfficeViewWatermark {
    /** The frame of the picture, in points, centred on the page: A4 and Letter, in either direction, lie inside it. The mark is clipped to the page by the editor. */
    private static final double FRAME_WIDTH = 850;
    private static final double FRAME_HEIGHT = 850;
    /** Pixels of the picture for each point: the editor shows a point as 1.33 pixels at 100% zoom, and a screen of a high density or a zoom of 150% needs more, so the text stays sharp. */
    private static final double PIXELS_PER_POINT = 2.5;
    private static final double MM_PER_POINT = 0.3528;
    /** The sizes of the PDF watermark: one large mark centred, or a smaller mark repeated. */
    private static final double SINGLE_SIZE = 76;
    private static final double TILE_SIZE = 30;
    private static final double TILE_STEP_ALONG = 420;
    private static final double TILE_STEP_ACROSS = 240;
    /** A copy whose centre lies further than this outside the frame cannot show on it. */
    private static final double EDGE = 60;

    private OnlyOfficeViewWatermark() {
    }

    /** True when the administrator switched the viewer watermark on. */
    public static boolean enabled(JsonNode viewer) {
        return viewer != null && viewer.path("watermarkEnabled").asBoolean(false);
    }

    /** The {@code watermark_on_draw} value for one opening of the viewer, or null when the watermark is off. */
    public static ObjectNode build(ObjectMapper mapper, JsonNode viewer, PreviewWatermark.Context context) {
        if (!enabled(viewer)) {
            return null;
        }
        List<String> lines = PreviewWatermark.linesFor(viewer, context);
        float[] colour = PreviewWatermark.rgbFor(viewer.path("watermarkColor").asText(PreviewWatermark.DEFAULT_COLOR));
        float alpha = PreviewWatermark.alphaFor(viewer.path("watermarkStrength").asText("standard"));
        int angle = PreviewWatermark.angleFor(viewer);
        boolean tiled = viewer.path("watermarkTiled").asBoolean(false);

        byte[] picture;
        try {
            picture = draw(lines, new Color(colour[0], colour[1], colour[2]), angle, tiled);
        } catch (IOException ex) {
            throw new IllegalStateException("The watermark picture could not be made", ex);
        }
        ObjectNode mark = mapper.createObjectNode();
        mark.put("width", Math.round(FRAME_WIDTH * MM_PER_POINT));
        mark.put("height", Math.round(FRAME_HEIGHT * MM_PER_POINT));
        mark.put("rotate", 0);
        mark.put("transparent", alpha);
        mark.put("fill", "data:image/png;base64," + Base64.getEncoder().encodeToString(picture));
        // The editor reads the text of the mark to load its fonts; the picture carries the drawing, so this stays short.
        mark.putArray("paragraphs").addObject().putArray("runs").addObject().put("text", " ");
        return mark;
    }

    /** The picture of the watermark: transparent, with the blocks in the colour, to be shown at the opacity of the strength. */
    static byte[] draw(List<String> lines, Color colour, int angle, boolean tiled) throws IOException {
        int width = (int) Math.round(FRAME_WIDTH * PIXELS_PER_POINT);
        int height = (int) Math.round(FRAME_HEIGHT * PIXELS_PER_POINT);
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
            g.scale(PIXELS_PER_POINT, PIXELS_PER_POINT);
            g.setColor(colour);
            double radians = Math.toRadians(angle);
            double cos = Math.cos(radians), sin = Math.sin(radians);
            double centreX = FRAME_WIDTH / 2, centreY = FRAME_HEIGHT / 2;
            if (!tiled) {
                block(g, lines, centreX, centreY, SINGLE_SIZE, angle);
            } else {
                // The lattice of the PDF: copies on rows that run along the text, turned by the same angle.
                double reach = Math.hypot(FRAME_WIDTH, FRAME_HEIGHT) / 2 + Math.max(TILE_STEP_ALONG, TILE_STEP_ACROSS);
                int alongCount = (int) Math.ceil(reach / TILE_STEP_ALONG);
                int acrossCount = (int) Math.ceil(reach / TILE_STEP_ACROSS);
                for (int i = -alongCount; i <= alongCount; i++) {
                    for (int j = -acrossCount; j <= acrossCount; j++) {
                        double x = centreX + i * TILE_STEP_ALONG * cos - j * TILE_STEP_ACROSS * sin;
                        double y = centreY - (i * TILE_STEP_ALONG * sin + j * TILE_STEP_ACROSS * cos); // the picture grows downwards, the PDF upwards
                        if (x < -EDGE || x > FRAME_WIDTH + EDGE || y < -EDGE || y > FRAME_HEIGHT + EDGE) {
                            continue;
                        }
                        block(g, lines, x, y, TILE_SIZE, angle);
                    }
                }
            }
        } finally {
            g.dispose();
        }
        return indexedPng(image, colour);
    }

    /**
     * The picture as an 8-bit PNG: one colour, 256 degrees of opacity, so a page of text weighs tens of kilobytes and not hundreds. The picture goes inside the
     * signed configuration of the editor, so its size matters.
     */
    private static byte[] indexedPng(BufferedImage argb, Color colour) throws IOException {
        byte[] reds = new byte[256], greens = new byte[256], blues = new byte[256], alphas = new byte[256];
        for (int i = 0; i < 256; i++) {
            reds[i] = (byte) colour.getRed();
            greens[i] = (byte) colour.getGreen();
            blues[i] = (byte) colour.getBlue();
            alphas[i] = (byte) i;
        }
        IndexColorModel model = new IndexColorModel(8, 256, reds, greens, blues, alphas);
        BufferedImage indexed = new BufferedImage(argb.getWidth(), argb.getHeight(), BufferedImage.TYPE_BYTE_INDEXED, model);
        byte[] target = ((DataBufferByte) indexed.getRaster().getDataBuffer()).getData();
        int[] source = argb.getRGB(0, 0, argb.getWidth(), argb.getHeight(), null, 0, argb.getWidth());
        for (int i = 0; i < source.length; i++) {
            target[i] = (byte) (source[i] >>> 24);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(indexed, "png", out);
        return out.toByteArray();
    }

    /** One copy of the block: every line centred on the same axis, the block turned about its centre. The same arrangement as {@code PreviewWatermark.drawBlock}. */
    private static void block(Graphics2D g, List<String> lines, double centreX, double centreY, double mainSize, int angle) {
        double detailSize = PreviewWatermark.detailSizeFor((float) mainSize);
        double lineGap = detailSize * 1.5;
        double mainOffsetAcross = (lines.size() - 1) * lineGap / 2;
        AffineTransform saved = g.getTransform();
        try {
            g.translate(centreX, centreY);
            g.rotate(-Math.toRadians(angle));
            for (int line = 0; line < lines.size(); line++) {
                double size = line == 0 ? mainSize : detailSize;
                g.setFont(new Font(FONT_FAMILY, Font.BOLD, 100).deriveFont((float) size));
                FontMetrics metrics = g.getFontMetrics();
                double along = -metrics.stringWidth(lines.get(line)) / 2.0;
                double across = line == 0 ? mainOffsetAcross : mainOffsetAcross - line * lineGap;
                g.drawString(lines.get(line), (float) along, (float) -across);
            }
        } finally {
            g.setTransform(saved);
        }
    }

    private static final String FONT_FAMILY = pickFontFamily();

    private static String pickFontFamily() {
        try {
            Set<String> families = Set.of(GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames());
            // The PDF watermark is Helvetica Bold. Liberation Sans (installed in the image) and Arial have the same letter widths, so the two previews match;
            // DejaVu Sans is the last resort and is wider.
            for (String family : List.of("Liberation Sans", "Arial", "Helvetica", "DejaVu Sans", "Segoe UI")) {
                if (families.contains(family)) {
                    return family;
                }
            }
        } catch (Throwable ignored) {
            // No font configuration: the logical font is used.
        }
        return Font.SANS_SERIF;
    }
}
