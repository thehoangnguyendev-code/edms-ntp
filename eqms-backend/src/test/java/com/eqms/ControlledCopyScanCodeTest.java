package com.eqms;

import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.ControlledCopyPdfMarkingService.Marked;
import com.eqms.service.ControlledCopyPdfMarkingService.Placement;
import com.eqms.service.ControlledCopyScanCodeService;
import com.eqms.service.ControlledCopyScanCodeService.DecodeResult;
import com.google.zxing.common.BitMatrix;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * The QR code printed on a paper Controlled Copy and read back from its scan (Decision COPY-RECALL-SCAN-2026-10-06):
 * token format, a full print -> scan round trip, and the files a DCO will actually feed it that are not clean.
 */
class ControlledCopyScanCodeTest {

    private final ControlledCopyPdfMarkingService marking = new ControlledCopyPdfMarkingService();

    private static byte[] blankPdf(int rotation) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            page.setRotation(rotation);
            document.addPage(page);
            document.save(out);
            return out.toByteArray();
        }
    }

    private Marked stamp(byte[] pdf, String token, String position, List<Placement> obstacles) {
        BitMatrix symbol = ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(token));
        return marking.applyScanCode(pdf, symbol, "CC-SOP.0001-001", position, 20, 4, obstacles);
    }

    private static byte[] render(byte[] pdf, int dpi, String format) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            BufferedImage image = new PDFRenderer(document).renderImageWithDPI(0, dpi, ImageType.RGB);
            ImageIO.write(image, format, out);
            return out.toByteArray();
        }
    }

    // ── Token ────────────────────────────────────────────────────────────────

    @Test
    void tokens_are_long_random_and_use_the_qr_alphanumeric_alphabet() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            String token = ControlledCopyScanCodeService.newToken();
            assertThat(token).hasSize(26).matches("[A-Z2-7]{26}");
            assertThat(seen.add(token)).as("tokens must not repeat").isTrue();
        }
    }

    @Test
    void only_a_well_formed_eqms_payload_yields_a_token() {
        String token = ControlledCopyScanCodeService.newToken();
        assertThat(ControlledCopyScanCodeService.tokenFrom(ControlledCopyScanCodeService.payload(token))).contains(token);
        assertThat(ControlledCopyScanCodeService.tokenFrom("  " + ControlledCopyScanCodeService.payload(token) + "\n")).contains(token);

        assertThat(ControlledCopyScanCodeService.tokenFrom(null)).isEmpty();
        assertThat(ControlledCopyScanCodeService.tokenFrom("https://example.com/" + token)).isEmpty();
        assertThat(ControlledCopyScanCodeService.tokenFrom("EQMSCC2:" + token)).isEmpty();
        assertThat(ControlledCopyScanCodeService.tokenFrom("EQMSCC1:" + token.substring(1))).isEmpty();
        assertThat(ControlledCopyScanCodeService.tokenFrom("EQMSCC1:" + token.toLowerCase())).isEmpty();
        assertThat(ControlledCopyScanCodeService.tokenFrom("EQMSCC1:" + token.substring(0, 25) + "1")).isEmpty();
    }

    // ── Print and scan back ──────────────────────────────────────────────────

    @Test
    void a_printed_pdf_decodes_back_to_the_same_token() throws Exception {
        String token = ControlledCopyScanCodeService.newToken();
        byte[] stamped = stamp(blankPdf(0), token, "BOTTOM_RIGHT", List.of()).pdf();

        DecodeResult result = ControlledCopyScanCodeService.decode(stamped);

        assertThat(result.status()).isEqualTo(ControlledCopyScanCodeService.STATUS_DECODED);
        assertThat(result.token()).isEqualTo(token);
    }

    @Test
    void the_code_survives_every_corner_and_a_rotated_page() throws Exception {
        for (String corner : List.of("TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT")) {
            for (int rotation : new int[] {0, 90, 180, 270}) {
                String token = ControlledCopyScanCodeService.newToken();
                byte[] stamped = stamp(blankPdf(rotation), token, corner, List.of()).pdf();
                assertThat(ControlledCopyScanCodeService.decode(stamped).token())
                        .as("corner %s on a page rotated %d", corner, rotation).isEqualTo(token);
            }
        }
    }

    @Test
    void a_photographic_scan_of_the_page_still_decodes() throws Exception {
        String token = ControlledCopyScanCodeService.newToken();
        byte[] stamped = stamp(blankPdf(0), token, "TOP_RIGHT", List.of()).pdf();

        // 150 DPI JPEG is a typical office-scanner "document" setting, with JPEG's lossy artefacts.
        DecodeResult jpeg = ControlledCopyScanCodeService.decode(render(stamped, 150, "jpg"));
        DecodeResult png = ControlledCopyScanCodeService.decode(render(stamped, 150, "png"));

        assertThat(jpeg.token()).isEqualTo(token);
        assertThat(png.token()).isEqualTo(token);
    }

    @Test
    void the_configured_corner_is_used_and_the_placement_is_reported() throws Exception {
        Marked marked = stamp(blankPdf(0), ControlledCopyScanCodeService.newToken(), "TOP_LEFT", List.of());

        assertThat(marked.placements()).hasSize(1);
        Placement placement = marked.placements().get(0);
        assertThat(placement.kind()).isEqualTo(ControlledCopyPdfMarkingService.KIND_QR);
        assertThat(placement.page()).isZero();
        assertThat(placement.adjusted()).isFalse();
        // Top-left: near the left edge, near the top edge of an A4 page.
        assertThat(placement.x()).isLessThan(30f);
        assertThat(placement.y() + placement.height()).isGreaterThan(PDRectangle.A4.getHeight() - 30f);
    }

    @Test
    void a_position_placed_by_hand_is_used_exactly_when_it_is_free_and_stays_readable() throws Exception {
        String token = ControlledCopyScanCodeService.newToken();
        BitMatrix symbol = ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(token));

        Marked marked = marking.applyScanCode(blankPdf(0), symbol, "CC-1", "BOTTOM_RIGHT", 0.25, 0.5, 25, 4, List.of());

        Placement placement = marked.placements().get(0);
        assertThat(placement.adjusted()).isFalse();
        assertThat(placement.x()).isCloseTo(0.25f * PDRectangle.A4.getWidth(), within(0.01f));
        // Top-left of the frame is half-way down the page.
        assertThat(placement.y() + placement.height()).isCloseTo(0.5f * PDRectangle.A4.getHeight(), within(0.01f));
        assertThat(ControlledCopyScanCodeService.decode(marked.pdf()).token()).isEqualTo(token);
    }

    @Test
    void a_code_dropped_on_the_stamp_or_the_watermark_jumps_to_the_nearest_free_place() throws Exception {
        String token = ControlledCopyScanCodeService.newToken();
        BitMatrix symbol = ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(token));
        float w = PDRectangle.A4.getWidth();
        float h = PDRectangle.A4.getHeight();
        Placement stampThere = new Placement(0, "STAMP", 100f, h / 2f, 200f, 60f, w, h, 0f, false);
        // A diagonal watermark through the middle of the page.
        Placement watermark = new Placement(0, "WATERMARK", w / 2f - 150f, h / 2f - 40f, 300f, 80f, w, h, 35f, false);
        List<Placement> others = List.of(stampThere, watermark);

        // Dropped right on the stamp (a little below the page middle).
        Marked marked = marking.applyScanCode(blankPdf(0), symbol, "CC-1", "BOTTOM_RIGHT", 0.25, 0.45, 20, 4, others);

        Placement placement = marked.placements().get(0);
        assertThat(placement.adjusted()).isTrue();
        assertThat(placement.overlaps(stampThere, 0f)).isFalse();
        assertThat(placement.overlaps(watermark, 0f)).isFalse();
        assertThat(placement.x()).isBetween(0f, w - placement.width());
        assertThat(placement.y()).isBetween(0f, h - placement.height());
        // It is close to where it was dropped, not thrown to a far corner.
        float droppedX = 0.25f * w;
        float droppedTop = 0.45f * h;
        assertThat(Math.hypot(placement.x() - droppedX, (placement.y() + placement.height()) - droppedTop)).isLessThan(0.45f * h);
        assertThat(ControlledCopyScanCodeService.decode(marked.pdf()).token()).isEqualTo(token);
    }

    @Test
    void a_position_dropped_past_the_edge_is_pulled_back_onto_the_page() throws Exception {
        BitMatrix symbol = ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(ControlledCopyScanCodeService.newToken()));

        Marked marked = marking.applyScanCode(blankPdf(0), symbol, "CC-1", "BOTTOM_RIGHT", 1.0, 1.0, 20, 4, List.of());

        Placement placement = marked.placements().get(0);
        assertThat(placement.x() + placement.width()).isLessThanOrEqualTo(PDRectangle.A4.getWidth() + 0.01f);
        assertThat(placement.y()).isGreaterThanOrEqualTo(0f);
    }

    @Test
    void an_occupied_corner_moves_the_code_to_the_next_free_one() throws Exception {
        Placement stampInBottomRight = new Placement(0, "STAMP", PDRectangle.A4.getWidth() - 150f, 8f, 140f, 60f,
                PDRectangle.A4.getWidth(), PDRectangle.A4.getHeight(), 0f, false);
        String token = ControlledCopyScanCodeService.newToken();

        Marked marked = stamp(blankPdf(0), token, "BOTTOM_RIGHT", List.of(stampInBottomRight));

        Placement placement = marked.placements().get(0);
        assertThat(placement.adjusted()).isTrue();
        assertThat(placement.overlaps(stampInBottomRight, 0f)).isFalse();
        assertThat(ControlledCopyScanCodeService.decode(marked.pdf()).token()).isEqualTo(token);
    }

    // ── Files that are not a clean single-code scan ──────────────────────────

    @Test
    void a_page_without_a_code_is_reported_as_not_found() throws Exception {
        assertThat(ControlledCopyScanCodeService.decode(blankPdf(0)).status())
                .isEqualTo(ControlledCopyScanCodeService.STATUS_NOT_FOUND);
    }

    @Test
    void bytes_that_are_not_a_pdf_or_image_are_unreadable_not_an_error() {
        assertThat(ControlledCopyScanCodeService.decode("not a scan".getBytes()).status())
                .isEqualTo(ControlledCopyScanCodeService.STATUS_UNREADABLE_FILE);
        assertThat(ControlledCopyScanCodeService.decode(new byte[0]).status())
                .isEqualTo(ControlledCopyScanCodeService.STATUS_UNREADABLE_FILE);
        assertThat(ControlledCopyScanCodeService.decode(null).status())
                .isEqualTo(ControlledCopyScanCodeService.STATUS_UNREADABLE_FILE);
        // Looks like a PDF but is truncated.
        assertThat(ControlledCopyScanCodeService.decode("%PDF-1.7\n1 0 obj".getBytes()).status())
                .isEqualTo(ControlledCopyScanCodeService.STATUS_UNREADABLE_FILE);
    }

    @Test
    void a_foreign_qr_code_is_not_mistaken_for_a_controlled_copy() throws Exception {
        BitMatrix other = ControlledCopyScanCodeService.encode("https://example.com/not-ours");
        byte[] stamped = marking.applyScanCode(blankPdf(0), other, "X", "TOP_RIGHT", 20, 4, List.of()).pdf();

        DecodeResult result = ControlledCopyScanCodeService.decode(stamped);

        assertThat(result.status()).isEqualTo(ControlledCopyScanCodeService.STATUS_FOREIGN);
        assertThat(result.token()).isNull();
        assertThat(result.rawValue()).isEqualTo("https://example.com/not-ours");
    }

    @Test
    void two_different_codes_on_one_scan_are_reported_as_multiple() throws Exception {
        byte[] once = stamp(blankPdf(0), ControlledCopyScanCodeService.newToken(), "TOP_LEFT", List.of()).pdf();
        byte[] twice = stamp(once, ControlledCopyScanCodeService.newToken(), "BOTTOM_RIGHT", List.of()).pdf();

        DecodeResult result = ControlledCopyScanCodeService.decode(twice);

        assertThat(result.status()).isEqualTo(ControlledCopyScanCodeService.STATUS_MULTIPLE);
        assertThat(result.token()).isNull();
    }

    @Test
    void file_type_is_taken_from_the_bytes_not_from_a_claimed_name_or_type() throws Exception {
        assertThat(ControlledCopyScanCodeService.sniffContentType(blankPdf(0))).isEqualTo("application/pdf");
        assertThat(ControlledCopyScanCodeService.sniffContentType(render(blankPdf(0), 50, "png"))).isEqualTo("image/png");
        assertThat(ControlledCopyScanCodeService.sniffContentType(render(blankPdf(0), 50, "jpg"))).isEqualTo("image/jpeg");
        assertThat(ControlledCopyScanCodeService.sniffContentType("MZ\u0090\u0000".getBytes())).isNull();
        assertThat(ControlledCopyScanCodeService.sniffContentType(null)).isNull();
    }

    @Test
    void an_image_with_a_code_decodes_without_a_pdf() throws Exception {
        String token = ControlledCopyScanCodeService.newToken();
        BitMatrix symbol = ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(token));
        int module = 6;
        int quiet = 4 * module;
        BufferedImage image = new BufferedImage(symbol.getWidth() * module + 2 * quiet, symbol.getHeight() * module + 2 * quiet,
                BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());
        g.setColor(Color.BLACK);
        for (int y = 0; y < symbol.getHeight(); y++) {
            for (int x = 0; x < symbol.getWidth(); x++) {
                if (symbol.get(x, y)) {
                    g.fillRect(quiet + x * module, quiet + y * module, module, module);
                }
            }
        }
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);

        assertThat(ControlledCopyScanCodeService.decode(out.toByteArray()).token()).isEqualTo(token);
    }

    @Test
    void the_code_goes_on_every_page_with_its_page_number_or_on_the_first_page_only() throws Exception {
        byte[] threePages;
        try (org.apache.pdfbox.pdmodel.PDDocument document = new org.apache.pdfbox.pdmodel.PDDocument();
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            for (int i = 0; i < 3; i++) {
                document.addPage(new org.apache.pdfbox.pdmodel.PDPage(org.apache.pdfbox.pdmodel.common.PDRectangle.A4));
            }
            document.save(out);
            threePages = out.toByteArray();
        }
        String token = ControlledCopyScanCodeService.newToken();
        java.util.function.IntFunction<com.google.zxing.common.BitMatrix> symbols = index ->
                ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.pagePayload(token, index + 1, 3));

        var everyPage = new ControlledCopyPdfMarkingService().applyScanCodes(
                threePages, symbols, true, "CC-1", "BOTTOM_RIGHT", null, null, 20, 4, List.of());
        var firstOnly = new ControlledCopyPdfMarkingService().applyScanCodes(
                threePages, symbols, false, "CC-1", "BOTTOM_RIGHT", null, null, 20, 4, List.of());

        var all = ControlledCopyScanCodeService.decodePages(everyPage.pdf());
        org.assertj.core.api.Assertions.assertThat(all).extracting(page -> page.code().page()).containsExactly(1, 2, 3);
        org.assertj.core.api.Assertions.assertThat(all).extracting(page -> page.code().pages()).containsOnly(3);
        org.assertj.core.api.Assertions.assertThat(everyPage.placements()).extracting(p -> p.page()).containsExactly(0, 1, 2);
        var first = ControlledCopyScanCodeService.decodePages(firstOnly.pdf());
        org.assertj.core.api.Assertions.assertThat(first.get(0).code().page()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(first.get(1).code()).isNull();
        org.assertj.core.api.Assertions.assertThat(first.get(2).code()).isNull();
        org.assertj.core.api.Assertions.assertThat(firstOnly.placements()).hasSize(1);
    }
}
