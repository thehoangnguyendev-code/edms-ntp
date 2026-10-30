package com.eqms.service;

import com.eqms.service.PwaBrandingService.Source;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The home-screen shortcut: what is accepted, the sizes that are made, and a manifest whose addresses change with the icon. */
class PwaBrandingServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final PwaBrandingService service = new PwaBrandingService();

    private static String png(int width, int height, Color color) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        var g = image.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
    }

    private JsonNode general(String icon, String shortName, String background) {
        var node = mapper.createObjectNode();
        if (icon != null) node.put("appIcon", icon);
        if (shortName != null) node.put("appShortName", shortName);
        if (background != null) node.put("appIconBackground", background);
        return node;
    }

    @Test
    void anIconThatIsTooSmallNotSquareOrNotAnImageIsRefused() throws Exception {
        assertThatThrownBy(() -> PwaBrandingService.validate(general(png(300, 300, Color.RED), null, null))).hasMessageContaining("at least 512");
        assertThatThrownBy(() -> PwaBrandingService.validate(general(png(2000, 600, Color.RED), null, null))).hasMessageContaining("roughly square");
        assertThatThrownBy(() -> PwaBrandingService.validate(general("data:image/svg+xml;base64,PHN2Zy8+", null, null))).hasMessageContaining("PNG or JPEG");
        assertThatThrownBy(() -> PwaBrandingService.validate(general("data:image/png;base64,AAAA", null, null))).hasMessageContaining("not a valid image");
        assertThatThrownBy(() -> PwaBrandingService.validate(general("https://evil.example/x.png", null, null))).hasMessageContaining("PNG or JPEG");
    }

    @Test
    void aGoodIconTheShortNameAndTheColourAreAccepted_andNothingIsCheckedWhenNoIconIsSet() throws Exception {
        PwaBrandingService.validate(general(png(512, 512, Color.GREEN), "EQMS", "#0F766E"));
        PwaBrandingService.validate(general(null, null, null));
        PwaBrandingService.validate(general("", "", ""));
    }

    @Test
    void theShortNameAndTheColourAreChecked() {
        PwaBrandingService.validate(general(null, "Ngoc Thien Quality Management System", null));
        PwaBrandingService.validate(general(null, "A".repeat(64), null));
        assertThatThrownBy(() -> PwaBrandingService.validate(general(null, "A".repeat(65), null))).hasMessageContaining("at most 64");
        assertThatThrownBy(() -> PwaBrandingService.validate(general(null, "Line\nbreak", null))).hasMessageContaining("control");
        assertThatThrownBy(() -> PwaBrandingService.validate(general(null, null, "red"))).hasMessageContaining("colour");
    }

    @Test
    void everySizeIsDrawnOnTheBackground_andTheMaskableOneKeepsTheLogoInsideASafeZone() throws Exception {
        Source source = new Source(png(1024, 1024, Color.RED), "EQMS", "#0000FF", "Quality System", null);

        for (var entry : java.util.Map.of("icon-192.png", 192, "icon-512.png", 512, "icon-maskable-512.png", 512, "apple-touch-icon.png", 180).entrySet()) {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(service.icon(source, entry.getKey()).orElseThrow()));
            assertThat(image.getWidth()).isEqualTo(entry.getValue());
            assertThat(image.getHeight()).isEqualTo(entry.getValue());
            assertThat(new Color(image.getRGB(0, 0))).as(entry.getKey() + " corner is the background").isEqualTo(new Color(0, 0, 255));
            assertThat(new Color(image.getRGB(image.getWidth() / 2, image.getHeight() / 2))).as(entry.getKey() + " centre is the logo").isEqualTo(Color.RED);
        }
        BufferedImage maskable = ImageIO.read(new ByteArrayInputStream(service.icon(source, "icon-maskable-512.png").orElseThrow()));
        BufferedImage any = ImageIO.read(new ByteArrayInputStream(service.icon(source, "icon-512.png").orElseThrow()));
        // 12% in from the edge: the plain icon already shows the logo there, the maskable one still shows only background
        assertThat(new Color(any.getRGB(60, 256))).isEqualTo(Color.RED);
        assertThat(new Color(maskable.getRGB(60, 256))).isEqualTo(new Color(0, 0, 255));
    }

    @Test
    void anUnknownSizeOrNoCustomIconGivesNothing() throws Exception {
        Source source = new Source(png(512, 512, Color.RED), null, null, "EQMS", null);
        assertThat(service.icon(source, "../../etc/passwd")).isEmpty();
        assertThat(service.icon(source, "icon-9999.png")).isEmpty();
        assertThat(service.icon(new Source(null, null, null, "EQMS", null), "icon-192.png")).isEmpty();
    }

    @Test
    void theVersionChangesWithTheIconTheColourAndTheNames_soEveryChangeIsANewAddress() throws Exception {
        Source a = new Source(png(512, 512, Color.RED), "EQMS", "#FFFFFF", "System", null);
        assertThat(service.version(a)).hasSize(12).isEqualTo(service.version(new Source(a.iconDataUrl(), "EQMS", "#FFFFFF", "System", null)));
        assertThat(service.version(a)).isNotEqualTo(service.version(new Source(png(512, 512, Color.BLUE), "EQMS", "#FFFFFF", "System", null)));
        assertThat(service.version(a)).isNotEqualTo(service.version(new Source(a.iconDataUrl(), "EQMS", "#000000", "System", null)));
        assertThat(service.version(a)).isNotEqualTo(service.version(new Source(a.iconDataUrl(), "Other", "#FFFFFF", "System", null)));
    }

    @Test
    void theManifestKeepsTheSameIdAndStartAddressAndPointsToTheVersionedIcons() throws Exception {
        Source custom = new Source(png(512, 512, Color.RED), "Ngoc Thien Quality Management", "#112233", "Quality Management System", "#059669");
        JsonNode m = mapper.readTree(service.manifest(custom));

        assertThat(m.get("id").asText()).isEqualTo("/");
        assertThat(m.get("start_url").asText()).isEqualTo("/");
        assertThat(m.get("short_name").asText()).isEqualTo("Ngoc Thien Quality Management");
        assertThat(m.get("name").asText()).isEqualTo("Quality Management System");
        assertThat(m.get("background_color").asText()).isEqualTo("#112233");
        assertThat(m.get("icons")).hasSize(3);
        assertThat(m.get("icons").get(2).get("purpose").asText()).isEqualTo("maskable");
        assertThat(m.get("icons").get(0).get("src").asText()).isEqualTo("/pwa/icon/icon-192.png?v=" + service.version(custom));
    }

    @Test
    void withoutACustomIconTheManifestUsesTheBuiltInIconAndAShortenedName() throws Exception {
        JsonNode m = mapper.readTree(service.manifest(new Source(null, null, null, "Quality Management System", null)));

        assertThat(m.get("icons").get(0).get("src").asText()).isEqualTo("/icons/apple-touch-icon.png");
        assertThat(m.get("short_name").asText()).isEqualTo("Quality Management System");
        assertThat(m.get("theme_color").asText()).isEqualTo("#059669");
    }
}
