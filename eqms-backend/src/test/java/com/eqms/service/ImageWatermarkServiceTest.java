package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The image watermark: where the block goes, how faint it is, what is left out when the picture is small, and what a save may contain. */
class ImageWatermarkServiceTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final ImageWatermarkService service = new ImageWatermarkService(null);
    private final ImageWatermarkService.Stamp stamp = new ImageWatermarkService.Stamp("An Nguyen", Instant.parse("2026-11-01T03:00:00Z"));

    private static JsonNode node(String json) throws Exception { return JSON.readTree(json); }

    private static BufferedImage logo() {
        BufferedImage logo = new BufferedImage(200, 100, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = logo.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 200, 100);
        g.dispose();
        return logo;
    }

    private static byte[] picture(int width, int height, String format, Color color) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    private static ImageWatermarkService.Settings settings(ImageWatermarkService.Position position, int size, int opacity, boolean uploader, boolean time, boolean logo) {
        return new ImageWatermarkService.Settings(true, logo, "SYSTEM", null, uploader, time, position, size, opacity, 3, true, logo ? logo() : null);
    }

    private static BufferedImage read(byte[] bytes) throws Exception { return ImageIO.read(new ByteArrayInputStream(bytes)); }

    private static boolean isRed(int rgb) { return ((rgb >> 16) & 0xFF) > 200 && ((rgb >> 8) & 0xFF) < 60 && (rgb & 0xFF) < 60; }

    @Test
    void theLogoGoesToTheCornerThatWasChosenAndNotToTheOthers() throws Exception {
        byte[] original = picture(1000, 600, "png", Color.WHITE);
        for (ImageWatermarkService.Position position : ImageWatermarkService.Position.values()) {
            ImageWatermarkService.Result result = service.apply(settings(position, 20, 100, false, false, true), original, stamp);
            assertThat(result.applied()).isTrue();
            BufferedImage image = read(result.bytes());
            boolean left = position == ImageWatermarkService.Position.TOP_LEFT || position == ImageWatermarkService.Position.BOTTOM_LEFT;
            boolean top = position == ImageWatermarkService.Position.TOP_LEFT || position == ImageWatermarkService.Position.TOP_RIGHT;
            int x = left ? 60 : 940, y = top ? 40 : 560;
            assertThat(isRed(image.getRGB(x, y))).as(position + " has the logo").isTrue();
            assertThat(isRed(image.getRGB(left ? 940 : 60, top ? 560 : 40))).as(position + " has nothing at the opposite corner").isFalse();
        }
    }

    @Test
    void theOpacityLetsThePictureShowThrough() throws Exception {
        byte[] original = picture(1000, 600, "png", Color.WHITE);
        BufferedImage full = read(service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 20, 100, false, false, true), original, stamp).bytes());
        BufferedImage faint = read(service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 20, 30, false, false, true), original, stamp).bytes());
        int solid = full.getRGB(60, 40) & 0xFF, light = faint.getRGB(60, 40) & 0xFF;
        assertThat(solid).isLessThan(60);
        assertThat(light).isGreaterThan(140);
    }

    @Test
    void theSizeSettingSetsTheWidthOfTheBlock() throws Exception {
        byte[] original = picture(1000, 2000, "png", Color.WHITE);
        int small = redWidth(service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 10, 100, false, false, true), original, stamp).bytes());
        int large = redWidth(service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 30, 100, false, false, true), original, stamp).bytes());
        assertThat(small).isBetween(95, 105);
        assertThat(large).isBetween(295, 305);
    }

    private static int redWidth(byte[] bytes) throws Exception {
        BufferedImage image = read(bytes);
        int count = 0;
        for (int x = 0; x < image.getWidth(); x++) if (isRed(image.getRGB(x, 40))) count++;
        return count;
    }

    @Test
    void theUploaderAndTheTimeChangeThePictureAndTheOriginalIsLeftAlone() throws Exception {
        byte[] original = picture(1000, 600, "jpeg", Color.DARK_GRAY);
        ImageWatermarkService.Result logoOnly = service.apply(settings(ImageWatermarkService.Position.BOTTOM_RIGHT, 25, 100, false, false, true), original, stamp);
        ImageWatermarkService.Result withText = service.apply(settings(ImageWatermarkService.Position.BOTTOM_RIGHT, 25, 100, true, true, true), original, stamp);
        assertThat(withText.applied()).isTrue();
        assertThat(withText.contentType()).isEqualTo("image/jpeg");
        assertThat(withText.bytes()).isNotEqualTo(logoOnly.bytes());
        assertThat(withText.originalSha256()).isEqualTo(logoOnly.originalSha256()).isNotEqualTo(withText.stampedSha256());
    }

    @Test
    void aSwitchedOffTargetReturnsTheOriginalWithTheReason() throws Exception {
        byte[] original = picture(400, 300, "png", Color.WHITE);
        ImageWatermarkService.Settings off = new ImageWatermarkService.Settings(false, true, "SYSTEM", null, true, true, ImageWatermarkService.Position.TOP_LEFT, 20, 100, 3, true, logo());
        ImageWatermarkService.Result result = service.apply(off, original, stamp);
        assertThat(result.applied()).isFalse();
        assertThat(result.bytes()).isEqualTo(original);
        assertThat(result.note()).contains("switched off");
        assertThat(result.originalSha256()).isEqualTo(result.stampedSha256());
    }

    @Test
    void aTinyPictureKeepsTheLogoOnlyOrIsLeftAloneAndNeverGetsASmudge() throws Exception {
        ImageWatermarkService.Result text = service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 20, 100, true, true, true), picture(300, 150, "png", Color.WHITE), stamp);
        assertThat(text.applied()).isTrue();
        assertThat(text.note()).contains("Text left out");
        ImageWatermarkService.Result tiny = service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 5, 100, true, true, true), picture(40, 20, "png", Color.WHITE), stamp);
        assertThat(tiny.applied()).isFalse();
        assertThat(tiny.note()).contains("too small");
    }

    @Test
    void theBlockNeverTakesMoreThanAThirdOfTheHeight() throws Exception {
        byte[] original = picture(1000, 200, "png", Color.WHITE);
        BufferedImage image = read(service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 40, 100, true, true, true), original, stamp).bytes());
        int lowest = 0;
        for (int y = 0; y < image.getHeight(); y++) for (int x = 0; x < 600; x++) if ((image.getRGB(x, y) & 0xFFFFFF) != 0xFFFFFF) lowest = Math.max(lowest, y);
        assertThat(lowest).isLessThan(200 * 35 / 100);
    }

    @Test
    void bytesThatOnlyClaimToBeAnImageAreRefused() {
        assertThatThrownBy(() -> service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 20, 100, false, false, true), "not an image".getBytes(), stamp))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("valid JPEG or PNG");
    }

    @Test
    void theDecodedFormatDecidesTheTypeNotTheName() throws Exception {
        ImageWatermarkService.Result result = service.apply(settings(ImageWatermarkService.Position.TOP_LEFT, 20, 100, false, false, true), picture(400, 300, "png", Color.WHITE), stamp);
        assertThat(result.contentType()).isEqualTo("image/png");
    }

    @Test
    void aTargetNeverSetUpKeepsTheEarlierBehaviour() throws Exception {
        ImageWatermarkService.Settings evidence = ImageWatermarkService.parse(ImageWatermarkService.Target.CONTROLLED_COPY_EVIDENCE, null, null);
        ImageWatermarkService.Settings specimen = ImageWatermarkService.parse(ImageWatermarkService.Target.SPECIMEN_SIGNATURE, null, null);
        assertThat(evidence.enabled()).isTrue();
        assertThat(evidence.position()).isEqualTo(ImageWatermarkService.Position.TOP_LEFT);
        assertThat(evidence.opacityPercent()).isEqualTo(100);
        assertThat(evidence.showUploadedBy()).isFalse();
        assertThat(specimen.enabled()).isFalse();
    }

    @Test
    void aSaveIsCheckedForRangesPositionsLogoAndAnEmptyStamp() throws Exception {
        ImageWatermarkService.validate(node("{}"));
        ImageWatermarkService.validate(node("{\"imageWatermark\":{\"controlledCopyEvidence\":{\"enabled\":true,\"position\":\"BOTTOM_RIGHT\",\"sizePercent\":25,\"opacityPercent\":60,\"showUploadedBy\":true}}}"));
        for (String bad : new String[]{
                "{\"controlledCopyEvidence\":{\"position\":\"CENTER\"}}",
                "{\"controlledCopyEvidence\":{\"sizePercent\":4}}",
                "{\"controlledCopyEvidence\":{\"sizePercent\":41}}",
                "{\"controlledCopyEvidence\":{\"opacityPercent\":9}}",
                "{\"specimenSignature\":{\"enabled\":true,\"showLogo\":false}}",
                "{\"specimenSignature\":{\"enabled\":true,\"logoSource\":\"CUSTOM\"}}",
                "{\"specimenSignature\":{\"logoData\":\"data:image/svg+xml;base64,AAAA\"}}",
                "{\"specimenSignature\":{\"enabled\":\"yes\"}}"}) {
            assertThatThrownBy(() -> ImageWatermarkService.validate(node("{\"imageWatermark\":" + bad + "}")), bad).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void theSampleIsAPictureOfTheRightKind() throws Exception {
        assertThat(read(service.sample(ImageWatermarkService.Target.CONTROLLED_COPY_EVIDENCE)).getWidth()).isGreaterThan(800);
        assertThat(read(service.sample(ImageWatermarkService.Target.SPECIMEN_SIGNATURE)).getHeight()).isLessThan(400);
    }
}
