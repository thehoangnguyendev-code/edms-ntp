package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.Graphics2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Stamps the logo, the name of the uploader and the time of the upload into a picture that comes into the system as evidence or as a specimen signature (JPEG and PNG only). The
 * server does it when it receives the file, so the stamp cannot be left out by calling the API directly and the name and the time are the ones of the signed-in user and of the server
 * clock. The caller keeps the original beside the stamped copy. How the stamp looks is set in Settings > Configuration > Image Watermark ({@code general.imageWatermark.<target>}); the
 * Configuration preview, the preview in the upload form and the real upload all run the same code here.
 */
@Service
public class ImageWatermarkService {
    /** What can carry a stamp, with the key of its settings. The two are set apart: a specimen signature is compared by its strokes, so its stamp is usually smaller and fainter. */
    public enum Target {
        CONTROLLED_COPY_EVIDENCE("controlledCopyEvidence", true),
        SPECIMEN_SIGNATURE("specimenSignature", false);

        private final String key;
        private final boolean enabledByDefault;

        Target(String key, boolean enabledByDefault) {
            this.key = key;
            this.enabledByDefault = enabledByDefault;
        }

        public String key() { return key; }

        public static Target fromKey(String key) {
            for (Target target : values()) if (target.key.equals(key)) return target;
            throw new IllegalArgumentException("Unknown image watermark target");
        }
    }

    public enum Position { TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT }

    /** The settings of one target, with the defaults filled in. {@code logo} is the picture to stamp, or null when there is none or it cannot be read. */
    public record Settings(boolean enabled, boolean showLogo, String logoSource, String logoData, boolean showUploadedBy, boolean showUploadedAt,
                           Position position, int sizePercent, int opacityPercent, int marginPercent, boolean textBackground, BufferedImage logo) { }

    public record Stamp(String uploadedBy, Instant uploadedAt) { }

    /** {@code applied} is false when nothing was stamped; then {@code bytes} are the original and {@code note} says why. */
    public record Result(byte[] bytes, String contentType, boolean applied, String note, String originalSha256, String stampedSha256) { }

    private record Decoded(BufferedImage image, String contentType, boolean jpeg) { }

    public static final int MIN_SIZE_PERCENT = 5, MAX_SIZE_PERCENT = 40, DEFAULT_SIZE_PERCENT = 20;
    public static final int MIN_OPACITY_PERCENT = 10, MAX_OPACITY_PERCENT = 100;
    public static final int MIN_MARGIN_PERCENT = 0, MAX_MARGIN_PERCENT = 10, DEFAULT_MARGIN_PERCENT = 3;
    /** The characters of a data URL of a custom logo (about 2 MB of picture). */
    static final int MAX_LOGO_DATA_LENGTH = 2_800_000;
    private static final java.util.regex.Pattern LOGO_DATA = java.util.regex.Pattern.compile("^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$");
    private static final Set<String> LOGO_SOURCES = Set.of("SYSTEM", "CUSTOM");
    private static final long MAX_PIXELS = 16L * 1024L * 1024L;
    private static final int MAX_DIMENSION = 4096;
    /** The stamp never covers more of the picture than this share of its height, or less than this width in pixels (then it is left out, not drawn as a smudge). */
    private static final double MAX_HEIGHT_SHARE = 0.30;
    private static final int MIN_BLOCK_WIDTH = 24;
    private static final double MIN_FONT_PIXELS = 7;

    private final SystemConfigurationService configuration;

    public ImageWatermarkService(SystemConfigurationService configuration) {
        this.configuration = configuration;
    }

    // ------------------------------------------------------------------------------------------------------------------------- settings

    /** The saved settings of a target. A target never set up keeps the earlier behaviour: evidence carries the system logo at the top left, a specimen carries nothing. */
    public Settings settings(Target target) {
        JsonNode node = configuration == null ? null : configuration.getImageWatermarkConfig(target.key());
        String systemLogo = configuration == null ? null : configuration.getPublicBranding().systemLogo();
        return parse(target, node, systemLogo);
    }

    /** Settings that are not saved yet (the draft of the Configuration screen). They are checked as strictly as a save. */
    public Settings draft(Target target, JsonNode node) {
        validateTarget(target.key(), node);
        String systemLogo = configuration == null ? null : configuration.getPublicBranding().systemLogo();
        return parse(target, node, systemLogo);
    }

    static Settings parse(Target target, JsonNode node, String systemLogo) {
        JsonNode n = node == null || node.isNull() ? com.fasterxml.jackson.databind.node.MissingNode.getInstance() : node;
        boolean showLogo = n.path("showLogo").asBoolean(true);
        String source = n.path("logoSource").asText("SYSTEM");
        if (!LOGO_SOURCES.contains(source)) source = "SYSTEM";
        String data = n.path("logoData").isTextual() ? n.path("logoData").asText() : null;
        String logoUri = "CUSTOM".equals(source) ? data : systemLogo;
        Position position;
        try { position = Position.valueOf(n.path("position").asText("TOP_LEFT")); } catch (IllegalArgumentException e) { position = Position.TOP_LEFT; }
        return new Settings(
                n.path("enabled").asBoolean(target.enabledByDefault), showLogo, source, data,
                n.path("showUploadedBy").asBoolean(false), n.path("showUploadedAt").asBoolean(false), position,
                clamp(n.path("sizePercent").asInt(DEFAULT_SIZE_PERCENT), MIN_SIZE_PERCENT, MAX_SIZE_PERCENT),
                clamp(n.path("opacityPercent").asInt(MAX_OPACITY_PERCENT), MIN_OPACITY_PERCENT, MAX_OPACITY_PERCENT),
                clamp(n.path("marginPercent").asInt(DEFAULT_MARGIN_PERCENT), MIN_MARGIN_PERCENT, MAX_MARGIN_PERCENT),
                n.path("textBackground").asBoolean(true),
                showLogo ? readLogo(logoUri) : null);
    }

    private static int clamp(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }

    private static BufferedImage readLogo(String dataUri) {
        if (!StringUtils.hasText(dataUri) || !dataUri.startsWith("data:image/")) return null;
        int comma = dataUri.indexOf(',');
        if (comma < 0) return null;
        try {
            return ImageIO.read(new ByteArrayInputStream(Base64.getDecoder().decode(dataUri.substring(comma + 1))));
        } catch (IllegalArgumentException | IOException ex) {
            return null;
        }
    }

    /** Checks the whole {@code general.imageWatermark} block of a configuration save; a block that is missing is fine. */
    public static void validate(JsonNode general) {
        JsonNode block = general == null ? null : general.get("imageWatermark");
        if (block == null || block.isNull()) return;
        if (!block.isObject()) throw new IllegalArgumentException("imageWatermark must be an object");
        for (Target target : Target.values()) validateTarget(target.key(), block.get(target.key()));
    }

    private static void validateTarget(String key, JsonNode node) {
        if (node == null || node.isNull()) return;
        if (!node.isObject()) throw new IllegalArgumentException("imageWatermark." + key + " must be an object");
        for (String flag : List.of("enabled", "showLogo", "showUploadedBy", "showUploadedAt", "textBackground")) {
            JsonNode value = node.get(flag);
            if (value != null && !value.isNull() && !value.isBoolean()) throw new IllegalArgumentException("imageWatermark." + key + "." + flag + " must be true or false");
        }
        JsonNode source = node.get("logoSource");
        if (source != null && !source.isNull() && (!source.isTextual() || !LOGO_SOURCES.contains(source.asText()))) {
            throw new IllegalArgumentException("imageWatermark." + key + ".logoSource must be one of " + LOGO_SOURCES);
        }
        JsonNode position = node.get("position");
        if (position != null && !position.isNull() && (!position.isTextual() || Arrays.stream(Position.values()).noneMatch(p -> p.name().equals(position.asText())))) {
            throw new IllegalArgumentException("imageWatermark." + key + ".position must be one of " + Arrays.toString(Position.values()));
        }
        range(node, key, "sizePercent", MIN_SIZE_PERCENT, MAX_SIZE_PERCENT);
        range(node, key, "opacityPercent", MIN_OPACITY_PERCENT, MAX_OPACITY_PERCENT);
        range(node, key, "marginPercent", MIN_MARGIN_PERCENT, MAX_MARGIN_PERCENT);
        JsonNode data = node.get("logoData");
        boolean hasData = data != null && !data.isNull() && !(data.isTextual() && data.asText().isEmpty());
        if (hasData && (!data.isTextual() || data.asText().length() > MAX_LOGO_DATA_LENGTH || !LOGO_DATA.matcher(data.asText()).matches())) {
            throw new IllegalArgumentException("imageWatermark." + key + ".logoData must be a PNG or JPEG of up to 2 MB");
        }
        boolean enabled = node.path("enabled").asBoolean(Target.fromKey(key).enabledByDefault);
        boolean showLogo = node.path("showLogo").asBoolean(true);
        if (enabled && !showLogo && !node.path("showUploadedBy").asBoolean(false) && !node.path("showUploadedAt").asBoolean(false)) {
            throw new IllegalArgumentException("imageWatermark." + key + " needs at least one thing to stamp: the logo, the uploader or the upload time");
        }
        if (enabled && showLogo && "CUSTOM".equals(node.path("logoSource").asText("SYSTEM")) && !hasData) {
            throw new IllegalArgumentException("imageWatermark." + key + " uses a custom logo but none was uploaded");
        }
    }

    private static void range(JsonNode node, String key, String field, int min, int max) {
        JsonNode value = node.get(field);
        if (value != null && !value.isNull() && (!value.isInt() || value.asInt() < min || value.asInt() > max)) {
            throw new IllegalArgumentException("imageWatermark." + key + "." + field + " must be a whole number from " + min + " to " + max);
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------- applying

    public Result apply(Target target, byte[] original, Stamp stamp) throws IOException {
        return apply(settings(target), original, stamp);
    }

    /** Stamps the picture, or returns it as it is (with the reason) when the target is switched off or the stamp does not fit. */
    public Result apply(Settings settings, byte[] original, Stamp stamp) throws IOException {
        Decoded decoded = decode(original);
        String hash = sha256(original);
        if (!settings.enabled()) return unchanged(original, decoded, hash, "Watermark is switched off");
        if (settings.logo() == null && !settings.showUploadedBy() && !settings.showUploadedAt()) return unchanged(original, decoded, hash, "Nothing to stamp: no logo could be read and no text is selected");

        BufferedImage source = scale(decoded.image());
        BufferedImage canvas = new BufferedImage(source.getWidth(), source.getHeight(), decoded.jpeg() ? BufferedImage.TYPE_INT_RGB : BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = canvas.createGraphics();
        try {
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }

        List<String> lines = new ArrayList<>();
        if (settings.showUploadedBy() && stamp != null && StringUtils.hasText(stamp.uploadedBy())) lines.add("Uploaded By: " + stamp.uploadedBy().trim());
        if (settings.showUploadedAt() && stamp != null && stamp.uploadedAt() != null) lines.add("Uploaded At: " + DateTimeFormatUtils.formatDateTime(stamp.uploadedAt()));

        String note = draw(canvas, settings, lines);
        if (note != null && !note.startsWith("Text left out")) return unchanged(original, decoded, hash, note);

        byte[] encoded = encode(canvas, decoded.jpeg() ? "jpg" : "png", decoded.jpeg() ? 0.92f : null);
        return new Result(encoded, decoded.contentType(), true, note, hash, sha256(encoded));
    }

    private Result unchanged(byte[] original, Decoded decoded, String hash, String note) {
        return new Result(original, decoded.contentType(), false, note, hash, hash);
    }

    private static final String FONT_FAMILY = pickFontFamily();

    private static String pickFontFamily() {
        try {
            Set<String> families = Set.of(GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames());
            for (String family : List.of("DejaVu Sans", "Arial", "Segoe UI")) if (families.contains(family)) return family;
        } catch (Throwable ignored) {
            // No font configuration: the logical font below is used.
        }
        return Font.SANS_SERIF;
    }

    /** Draws the block on the canvas. Returns null when drawn in full, a note starting "Text left out" when only the logo fitted, or the reason when nothing was drawn. */
    private String draw(BufferedImage canvas, Settings s, List<String> allLines) {
        int width = canvas.getWidth(), height = canvas.getHeight();
        double blockWidth = width * s.sizePercent() / 100.0;
        BufferedImage logo = s.logo();
        boolean leftOut = false;
        List<String> lines = allLines;
        Layout layout = layout(s, logo, lines, blockWidth, width, height);
        if (layout.fontPixels > 0 && layout.fontPixels < MIN_FONT_PIXELS && !lines.isEmpty()) {
            lines = List.of();
            leftOut = true;
            layout = layout(s, logo, lines, blockWidth, width, height);
        }
        if (layout.width < MIN_BLOCK_WIDTH || layout.height < 8 || (logo == null && lines.isEmpty())) return "The picture is too small for the watermark";

        int margin = (int) Math.round(Math.min(width, height) * s.marginPercent() / 100.0);
        boolean right = s.position() == Position.TOP_RIGHT || s.position() == Position.BOTTOM_RIGHT;
        boolean bottom = s.position() == Position.BOTTOM_LEFT || s.position() == Position.BOTTOM_RIGHT;
        int x = right ? width - margin - layout.width : margin;
        int y = bottom ? height - margin - layout.height : margin;
        if (x < 0 || y < 0) return "The picture is too small for the watermark";

        BufferedImage layer = new BufferedImage(layout.width, layout.height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = layer.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            if (s.textBackground() && !lines.isEmpty()) {
                g.setColor(new Color(255, 255, 255, 190));
                g.fill(new RoundRectangle2D.Double(0, 0, layout.width, layout.height, layout.padding, layout.padding));
            }
            double cursor = layout.padding;
            if (logo != null) {
                int logoX = right ? layout.width - (int) Math.round(layout.padding) - layout.logoWidth : (int) Math.round(layout.padding);
                g.drawImage(logo, logoX, (int) Math.round(cursor), layout.logoWidth, layout.logoHeight, null);
                cursor += layout.logoHeight + (lines.isEmpty() ? 0 : layout.fontPixels * 0.4);
            }
            if (!lines.isEmpty()) {
                Font font = new Font(FONT_FAMILY, Font.PLAIN, 100).deriveFont((float) layout.fontPixels);
                g.setFont(font);
                g.setColor(new Color(15, 23, 42));
                FontMetrics metrics = g.getFontMetrics();
                for (String line : lines) {
                    double textX = right ? layout.width - layout.padding - metrics.stringWidth(line) : layout.padding;
                    g.drawString(line, (float) textX, (float) (cursor + metrics.getAscent()));
                    cursor += layout.fontPixels * 1.25;
                }
            }
        } finally {
            g.dispose();
        }

        Graphics2D target = canvas.createGraphics();
        try {
            target.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            target.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, s.opacityPercent() / 100f));
            target.drawImage(layer, x, y, null);
        } finally {
            target.dispose();
        }
        return leftOut ? "Text left out: the picture is too small to keep it readable" : null;
    }

    private record Layout(int width, int height, int logoWidth, int logoHeight, double fontPixels, double padding) { }

    /** The size of the block: the logo and the lines of text, stacked, one block that is as wide as the setting says and never taller than {@link #MAX_HEIGHT_SHARE} of the picture. */
    private Layout layout(Settings s, BufferedImage logo, List<String> lines, double blockWidth, int imageWidth, int imageHeight) {
        double fontPixels = 0;
        double textWidth = 0;
        if (!lines.isEmpty()) {
            BufferedImage scratch = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = scratch.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
                g.setFont(new Font(FONT_FAMILY, Font.PLAIN, 100));
                FontMetrics metrics = g.getFontMetrics();
                double widest = 0;
                for (String line : lines) widest = Math.max(widest, metrics.stringWidth(line));
                // The longest line fills the block; a short text is not blown up beyond a readable size.
                fontPixels = Math.min(blockWidth * 100.0 / Math.max(1, widest), blockWidth * 0.09);
                textWidth = widest * fontPixels / 100.0;
            } finally {
                g.dispose();
            }
        }
        double padding = lines.isEmpty() ? 0 : Math.max(2, fontPixels * 0.5);
        double logoWidth = 0, logoHeight = 0;
        if (logo != null) {
            double scale = Math.min(blockWidth / logo.getWidth(), imageHeight / 8.0 / logo.getHeight());
            logoWidth = Math.max(1, logo.getWidth() * scale);
            logoHeight = Math.max(1, logo.getHeight() * scale);
        }
        double contentWidth = Math.max(logoWidth, textWidth);
        double contentHeight = logoHeight + (logo != null && !lines.isEmpty() ? fontPixels * 0.4 : 0) + lines.size() * fontPixels * 1.25;
        double width = contentWidth + 2 * padding, height = contentHeight + 2 * padding;
        double shrink = Math.min(1.0, imageHeight * MAX_HEIGHT_SHARE / Math.max(1, height));
        shrink = Math.min(shrink, imageWidth * 0.95 / Math.max(1, width));
        if (shrink < 1.0) {
            fontPixels *= shrink; padding *= shrink; logoWidth *= shrink; logoHeight *= shrink; width *= shrink; height *= shrink;
        }
        return new Layout((int) Math.ceil(width), (int) Math.ceil(height), (int) Math.round(logoWidth), (int) Math.round(logoHeight), fontPixels, padding);
    }

    // ------------------------------------------------------------------------------------------------------------------------- pictures

    /** A picture that is a real JPEG or PNG, of a bounded size; anything else is refused. */
    private Decoded decode(byte[] bytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) throw notAnImage();
            java.util.Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw notAnImage();
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                boolean jpeg = "jpeg".equals(format) || "jpg".equals(format);
                if (!jpeg && !"png".equals(format)) throw notAnImage();
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS) throw new IllegalArgumentException("The picture exceeds the maximum allowed pixel dimensions");
                BufferedImage image = reader.read(0);
                if (image == null) throw notAnImage();
                return new Decoded(image, jpeg ? "image/jpeg" : "image/png", jpeg);
            } finally {
                reader.dispose();
            }
        }
    }

    private static IllegalArgumentException notAnImage() { return new IllegalArgumentException("The file must be a valid JPEG or PNG image"); }

    private BufferedImage scale(BufferedImage source) {
        int longest = Math.max(source.getWidth(), source.getHeight());
        if (longest <= MAX_DIMENSION) return source;
        double scale = (double) MAX_DIMENSION / longest;
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale)), height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage resized = new BufferedImage(width, height, source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return resized;
    }

    private byte[] encode(BufferedImage source, String format, Float quality) throws IOException {
        BufferedImage image = source;
        if ("jpg".equals(format) && source.getColorModel().hasAlpha()) {
            image = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = image.createGraphics();
            try {
                g.setColor(Color.WHITE);
                g.fillRect(0, 0, image.getWidth(), image.getHeight());
                g.drawImage(source, 0, 0, null);
            } finally {
                g.dispose();
            }
        }
        if (quality == null) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, format, output);
            return output.toByteArray();
        }
        java.util.Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName(format);
        if (!writers.hasNext()) throw new IOException("No image writer available for " + format);
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream(); ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), param);
            imageOutput.flush();
            return output.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    /** A picture to try the settings on when nobody chose one: a grey scene for evidence, a signature-like stroke on white for a specimen. */
    public byte[] sample(Target target) throws IOException {
        boolean evidence = target == Target.CONTROLLED_COPY_EVIDENCE;
        int width = evidence ? 1200 : 700, height = evidence ? 800 : 300;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            if (evidence) {
                g.setPaint(new java.awt.GradientPaint(0, 0, new Color(148, 163, 184), width, height, new Color(51, 65, 85)));
                g.fillRect(0, 0, width, height);
                g.setColor(new Color(241, 245, 249));
                g.fillRoundRect(width / 5, height / 4, width * 3 / 5, height / 2, 24, 24);
                g.setColor(new Color(100, 116, 139));
                g.setFont(new Font(FONT_FAMILY, Font.BOLD, 40));
                g.drawString("Sample evidence photo", width / 5 + 40, height / 2 + 14);
            } else {
                g.setColor(Color.WHITE);
                g.fillRect(0, 0, width, height);
                g.setColor(new Color(30, 41, 59));
                g.setStroke(new java.awt.BasicStroke(4f, java.awt.BasicStroke.CAP_ROUND, java.awt.BasicStroke.JOIN_ROUND));
                java.awt.geom.Path2D path = new java.awt.geom.Path2D.Double();
                path.moveTo(80, 200); path.curveTo(140, 40, 200, 40, 230, 150); path.curveTo(250, 230, 330, 60, 400, 150);
                path.curveTo(450, 210, 520, 90, 620, 170);
                g.draw(path);
                g.setColor(new Color(148, 163, 184));
                g.setFont(new Font(FONT_FAMILY, Font.PLAIN, 22));
                g.drawString("Sample specimen signature", 80, 270);
            }
        } finally {
            g.dispose();
        }
        return encode(image, "png", null);
    }

    static String sha256(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) hex.append(String.format(Locale.ROOT, "%02x", value));
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
