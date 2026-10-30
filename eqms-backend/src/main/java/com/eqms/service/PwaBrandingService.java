package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * The shortcut icon an administrator chose for the home screen of a phone ("Add to Home Screen"), and the web app manifest that points to it.
 *
 * <p>The administrator uploads one image. The server makes the sizes the phones ask for, on the chosen background colour, so a transparent logo never turns
 * black on iOS: 192 and 512 for Android, a 512 icon with a safe zone for the adaptive (maskable) shapes, and 180 for iOS. Everything is public (a phone fetches
 * it before anyone signs in) and carries a version, so a changed icon is a new address.
 *
 * <p>What a device does with a change is up to the device: a new shortcut always gets the current icon; an Android shortcut refreshes the next time Chrome checks
 * its manifest; an iOS shortcut keeps the icon it was made with.
 */
@Service
public class PwaBrandingService {
    public static final String ICON_FIELD = "appIcon";
    public static final String SHORT_NAME_FIELD = "appShortName";
    public static final String BACKGROUND_FIELD = "appIconBackground";
    public static final int SHORT_NAME_MAX = 64;
    public static final int MAX_ENCODED_BYTES = 4 * 1024 * 1024;
    public static final int MIN_SIDE = 512;
    public static final int MAX_SIDE = 4096;
    static final String DEFAULT_BACKGROUND = "#FFFFFF";
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Pattern DATA_URL = Pattern.compile("^data:image/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$");

    /** The sizes served, by file name: the edge in pixels and how much of it the image fills (the rest is background). */
    private record Variant(int size, double fill) {}

    private static final Map<String, Variant> VARIANTS = Map.of(
            "icon-192.png", new Variant(192, 0.9),
            "icon-512.png", new Variant(512, 0.9),
            // Adaptive icons are cropped to a circle or a rounded shape: keep the picture inside the central safe zone.
            "icon-maskable-512.png", new Variant(512, 0.6),
            "apple-touch-icon.png", new Variant(180, 0.9));

    /** What the manifest is made of, read from the System Configuration. */
    public record Source(String iconDataUrl, String shortName, String background, String displayName, String themeColor) {
    }

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, byte[]> rendered = new ConcurrentHashMap<>();
    private volatile String renderedVersion = "";

    static {
        // The server has no screen: drawing must never look for one.
        System.setProperty("java.awt.headless", "true");
    }

    /** Refuses a configuration the phones could not use. Nothing is checked when no icon is set. */
    public static void validate(JsonNode general) {
        if (general == null) return;
        JsonNode name = general.get(SHORT_NAME_FIELD);
        if (name != null && !name.isNull()) {
            if (!name.isTextual()) throw new IllegalArgumentException(SHORT_NAME_FIELD + " must be text");
            String text = name.asText().strip();
            if (text.length() > SHORT_NAME_MAX) throw new IllegalArgumentException(SHORT_NAME_FIELD + " must be at most " + SHORT_NAME_MAX + " characters");
            if (text.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException(SHORT_NAME_FIELD + " must not contain control characters");
        }
        JsonNode background = general.get(BACKGROUND_FIELD);
        if (background != null && !background.isNull() && !background.asText().isBlank() && !COLOR.matcher(background.asText()).matches()) {
            throw new IllegalArgumentException(BACKGROUND_FIELD + " must be a colour such as #FFFFFF");
        }
        JsonNode icon = general.get(ICON_FIELD);
        if (icon == null || icon.isNull() || icon.asText().isBlank()) return;
        decode(icon.asText());
    }

    /** The decoded image, after the checks a phone icon needs: a PNG or JPEG, not too heavy, square enough, at least 512 pixels on each side. */
    static byte[] decode(String dataUrl) {
        if (dataUrl.length() > MAX_ENCODED_BYTES) throw new IllegalArgumentException(ICON_FIELD + " must be smaller than 3 MB");
        var matcher = DATA_URL.matcher(dataUrl);
        if (!matcher.matches()) throw new IllegalArgumentException(ICON_FIELD + " must be a PNG or JPEG image");
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(ICON_FIELD + " is not a valid image");
        }
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (in == null || !readers.hasNext()) throw new IllegalArgumentException(ICON_FIELD + " is not a valid image");
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                String format = reader.getFormatName().toLowerCase();
                if (!format.contains("png") && !format.contains("jpeg") && !format.contains("jpg")) throw new IllegalArgumentException(ICON_FIELD + " must be a PNG or JPEG image");
                if (width < MIN_SIDE || height < MIN_SIDE) throw new IllegalArgumentException(ICON_FIELD + " must be at least " + MIN_SIDE + " x " + MIN_SIDE + " pixels");
                if (width > MAX_SIDE || height > MAX_SIDE) throw new IllegalArgumentException(ICON_FIELD + " must be at most " + MAX_SIDE + " x " + MAX_SIDE + " pixels");
                if (Math.max(width, height) > 2.0 * Math.min(width, height)) throw new IllegalArgumentException(ICON_FIELD + " must be roughly square");
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new IllegalArgumentException(ICON_FIELD + " is not a valid image");
        }
        return bytes;
    }

    public boolean hasCustomIcon(Source source) {
        return source != null && source.iconDataUrl() != null && !source.iconDataUrl().isBlank();
    }

    /** Changes whenever the icon, the colour or the names change; it is part of every address, so a phone never reuses an old copy. */
    public String version(Source source) {
        if (source == null) return "";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String part : new String[]{source.iconDataUrl(), source.shortName(), source.background(), source.displayName()}) {
                digest.update((part == null ? "" : part).getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
            }
            return HexFormat.of().formatHex(digest.digest()).substring(0, 12);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** One of the icon files, or empty when no custom icon is set or the name is not one of the served sizes. */
    public Optional<byte[]> icon(Source source, String name) {
        Variant variant = VARIANTS.get(name);
        if (variant == null || !hasCustomIcon(source)) return Optional.empty();
        String version = version(source);
        if (!version.equals(renderedVersion)) {
            synchronized (this) {
                if (!version.equals(renderedVersion)) {
                    rendered.clear();
                    renderedVersion = version;
                }
            }
        }
        return Optional.of(rendered.computeIfAbsent(version + "/" + name, key -> render(decode(source.iconDataUrl()), variant, color(source.background()))));
    }

    static Color color(String hex) {
        return Color.decode(hex != null && COLOR.matcher(hex).matches() ? hex : DEFAULT_BACKGROUND);
    }

    /** The picture fitted inside the square without being cropped or stretched, on the background colour. */
    static byte[] render(byte[] imageBytes, Variant variant, Color background) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (source == null) throw new IllegalArgumentException(ICON_FIELD + " is not a valid image");
            BufferedImage out = new BufferedImage(variant.size(), variant.size(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(background);
                g.fillRect(0, 0, variant.size(), variant.size());
                double box = variant.size() * variant.fill();
                double scale = Math.min(box / source.getWidth(), box / source.getHeight());
                int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
                int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
                g.drawImage(source, (variant.size() - width) / 2, (variant.size() - height) / 2, width, height, null);
            } finally {
                g.dispose();
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            ImageIO.write(out, "png", bytes);
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("The shortcut icon could not be drawn", e);
        }
    }

    /**
     * The web app manifest. {@code id} and {@code start_url} stay the same whatever the icon is, so a phone treats a new icon as an update of the same app.
     * Without a custom icon the manifest points to the built-in one the application always had.
     */
    public String manifest(Source source) {
        ObjectNode manifest = objectMapper.createObjectNode();
        String displayName = source == null || source.displayName() == null || source.displayName().isBlank() ? "EQMS" : source.displayName().strip();
        String shortName = source != null && source.shortName() != null && !source.shortName().isBlank() ? source.shortName().strip()
                : displayName.length() <= SHORT_NAME_MAX ? displayName : displayName.substring(0, SHORT_NAME_MAX).strip();
        manifest.put("id", "/");
        manifest.put("name", displayName);
        manifest.put("short_name", shortName);
        manifest.put("start_url", "/");
        manifest.put("scope", "/");
        manifest.put("display", "standalone");
        String background = source != null && source.background() != null && COLOR.matcher(source.background()).matches() ? source.background() : DEFAULT_BACKGROUND;
        manifest.put("background_color", background);
        manifest.put("theme_color", source != null && source.themeColor() != null && COLOR.matcher(source.themeColor()).matches() ? source.themeColor() : "#059669");
        ArrayNode icons = manifest.putArray("icons");
        if (hasCustomIcon(source)) {
            String v = "?v=" + version(source);
            addIcon(icons, "/pwa/icon/icon-192.png" + v, "192x192", "any");
            addIcon(icons, "/pwa/icon/icon-512.png" + v, "512x512", "any");
            addIcon(icons, "/pwa/icon/icon-maskable-512.png" + v, "512x512", "maskable");
        } else {
            addIcon(icons, "/icons/apple-touch-icon.png", "192x192", "any");
            addIcon(icons, "/icons/apple-touch-icon.png", "512x512", "any");
        }
        return manifest.toString();
    }

    private static void addIcon(ArrayNode icons, String src, String sizes, String purpose) {
        ObjectNode icon = icons.addObject();
        icon.put("src", src);
        icon.put("sizes", sizes);
        icon.put("type", "image/png");
        icon.put("purpose", purpose);
    }
}
