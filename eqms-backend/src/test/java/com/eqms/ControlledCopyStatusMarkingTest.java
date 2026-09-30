package com.eqms;

import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyMarkingSection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.dto.controlledcopypolicy.MarkingPlacementRule;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Stamp and watermark of withdrawn / cancelled copies, and the integer strictness of the marking settings. */
class ControlledCopyStatusMarkingTest {

    private final ControlledCopyPdfMarkingService service = new ControlledCopyPdfMarkingService();
    private final ObjectMapper mapper = new ObjectMapper();

    private static byte[] pdf(PDRectangle size) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(size);
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(40, 200);
                content.showText("ORIGINAL BODY");
                content.endText();
            }
            document.save(out);
            return out.toByteArray();
        }
    }

    private static String text(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private static ControlledCopyStatusMarking patch(Boolean watermarkEnabled, Boolean stampEnabled, Integer opacity, String stampText) {
        return new ControlledCopyStatusMarking(watermarkEnabled, null, null, null, opacity, null, null, null, null, stampEnabled, stampText, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    @Test
    void defaults_differPerStatus() {
        ControlledCopyStatusMarking obsoleted = ControlledCopyStatusMarking.defaults("OBSOLETED");
        ControlledCopyStatusMarking cancelled = ControlledCopyStatusMarking.defaults("CLOSED_CANCELLED");
        assertEquals("WITHDRAWN", obsoleted.stampText());
        assertEquals("CANCELLED", cancelled.stampText());
    }

    @Test
    void mergedOver_keepsStoredValuesForFieldsNotSent() {
        ControlledCopyStatusMarking base = ControlledCopyStatusMarking.defaults("OBSOLETED");

        ControlledCopyStatusMarking merged = patch(null, null, 20, "VOID").mergedOver(base);

        assertEquals("VOID", merged.stampText());
        assertEquals(20, merged.watermarkOpacityPercent());
        assertEquals(base.watermarkColor(), merged.watermarkColor());
        assertEquals(base.stampPosition(), merged.stampPosition());
    }

    @Test
    void fractionalIntegers_areRefusedInsteadOfTruncated() {
        assertThrows(JsonMappingException.class, () -> mapper.readValue("{\"stampOpacityPercent\": 50.5}", ControlledCopyPolicyMarkingSection.class));
        assertThrows(JsonMappingException.class, () -> mapper.readValue("{\"watermarkAngleDegrees\": 12.9}", ControlledCopyStatusMarking.class));
        assertThrows(JsonMappingException.class, () -> mapper.readValue("{\"stampMarginMm\": \"abc\"}", ControlledCopyStatusMarking.class));
    }

    @Test
    void wholeIntegers_areAccepted() throws IOException {
        assertEquals(60, mapper.readValue("{\"stampOpacityPercent\": 60}", ControlledCopyPolicyMarkingSection.class).stampOpacityPercent());
        assertEquals(35, mapper.readValue("{\"watermarkAngleDegrees\": 35}", ControlledCopyStatusMarking.class).watermarkAngleDegrees());
    }

    @Test
    void statusMarking_drawsTheConfiguredStampAndWatermark() throws IOException {
        ControlledCopyStatusMarking config = ControlledCopyStatusMarking.defaults("OBSOLETED");

        String text = text(service.applyStatusMarking(pdf(PDRectangle.A4), config,
                List.of("RECALLED BY DOCUMENT CONTROL", "Withdrawn 26/09/2026"),
                List.of("WITHDRAWN", "Recalled by Document Control", "Withdrawn 26/09/2026")));

        assertTrue(text.contains("ORIGINAL BODY"));
        assertTrue(text.contains("RECALLED BY DOCUMENT CONTROL"));
        assertTrue(text.contains("WITHDRAWN"));
        // the stamp carries the reason and the date as separate lines (the rotated watermark text is not reliably extractable)
        assertTrue(text.contains("Recalled by Document Control"));
        assertTrue(text.contains("Withdrawn 26/09/2026"));
    }

    @Test
    void statusMarking_canBeStampOnlyOrWatermarkOnly() throws IOException {
        ControlledCopyStatusMarking base = ControlledCopyStatusMarking.defaults("CLOSED_CANCELLED");
        ControlledCopyStatusMarking stampOnly = patch(false, null, null, null).mergedOver(base);
        ControlledCopyStatusMarking watermarkOnly = patch(null, false, null, null).mergedOver(base);

        String stampText = text(service.applyStatusMarking(pdf(PDRectangle.A4), stampOnly, List.of("REQUEST CANCELLED"), List.of("CANCELLED")));
        String watermarkText = text(service.applyStatusMarking(pdf(PDRectangle.A4), watermarkOnly, List.of("REQUEST CANCELLED"), List.of("CANCELLED")));

        assertTrue(stampText.contains("CANCELLED") && !stampText.contains("REQUEST CANCELLED"));
        assertTrue(watermarkText.contains("REQUEST CANCELLED"));
    }

    @Test
    void watermarkLayer_decidesWhetherItIsBehindOrAboveTheContent() throws IOException {
        ControlledCopyStatusMarking behind = new ControlledCopyStatusMarking(null, "BEHIND", null, null, null, null, null, null, null, false, null, null, null, null, null, null, null, null, null, null, null, null, null)
                .mergedOver(ControlledCopyStatusMarking.defaults("OBSOLETED"));
        ControlledCopyStatusMarking above = new ControlledCopyStatusMarking(null, "ABOVE", null, null, null, null, null, null, null, false, null, null, null, null, null, null, null, null, null, null, null, null, null)
                .mergedOver(ControlledCopyStatusMarking.defaults("OBSOLETED"));

        String behindText = text(service.applyStatusMarking(pdf(PDRectangle.A4), behind, List.of("WATERMARK TEXT"), List.of()));
        String aboveText = text(service.applyStatusMarking(pdf(PDRectangle.A4), above, List.of("WATERMARK TEXT"), List.of()));

        // text is extracted in drawing order
        assertTrue(behindText.indexOf("WATERMARK TEXT") < behindText.indexOf("ORIGINAL BODY"), behindText);
        assertTrue(aboveText.indexOf("WATERMARK TEXT") > aboveText.indexOf("ORIGINAL BODY"), aboveText);
    }

    private static ControlledCopyPolicySetting issuedPolicy(String position) {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setStampEnabled(true);
        policy.setStampText("CONTROLLED COPY");
        policy.setStampPosition(position);
        policy.setStampSize("MEDIUM");
        policy.setWatermarkEnabled(true);
        return policy;
    }

    private static boolean overlap(ControlledCopyPdfMarkingService.Placement a, ControlledCopyPdfMarkingService.Placement b) {
        return a.x() < b.x() + b.width() && b.x() < a.x() + a.width() && a.y() < b.y() + b.height() && b.y() < a.y() + a.height();
    }

    @Test
    void statusStamp_isPlacedClearOfTheIssuedStamp_atTheSameCorner() throws IOException {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        ControlledCopyPdfMarkingService.Marked issued = service.applyWithLayout(
                pdf(PDRectangle.A4), copy, mapper.createObjectNode().put("name", "A"), issuedPolicy("TOP_RIGHT"));
        // The default status stamp sits in the same corner as the issued one.
        ControlledCopyStatusMarking status = ControlledCopyStatusMarking.defaults("OBSOLETED");

        ControlledCopyPdfMarkingService.Marked withStatus = service.applyStatusMarkingWithLayout(
                issued.pdf(), status, List.of("RECALLED"), List.of("WITHDRAWN", "Recalled"), issued.placements());

        ControlledCopyPdfMarkingService.Placement issuedStamp = issued.placements().stream().filter(p -> "STAMP".equals(p.kind())).findFirst().orElseThrow();
        ControlledCopyPdfMarkingService.Placement statusStamp = withStatus.placements().stream().filter(p -> "STAMP".equals(p.kind())).findFirst().orElseThrow();
        assertFalse(overlap(issuedStamp, statusStamp), "the status stamp must not cover the issued stamp");
        assertTrue(statusStamp.y() >= 0 && statusStamp.y() + statusStamp.height() <= statusStamp.pageHeight(), "still inside the page");
        assertTrue(statusStamp.x() >= 0 && statusStamp.x() + statusStamp.width() <= statusStamp.pageWidth(), "still inside the page");
    }

    @Test
    void statusStamp_keepsOffAnExistingStamp_evenWhenItsPositionWasNotRecorded() throws IOException {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        ControlledCopyPdfMarkingService.Marked issued = service.applyWithLayout(
                pdf(PDRectangle.A4), copy, mapper.createObjectNode().put("name", "A"), issuedPolicy("TOP_RIGHT"));
        ControlledCopyPdfMarkingService.Placement issuedStamp = issued.placements().stream().filter(p -> "STAMP".equals(p.kind())).findFirst().orElseThrow();

        // A copy issued before positions were recorded: the earlier stamp is read back from the stored PDF.
        List<ControlledCopyPdfMarkingService.Placement> detected = service.detectIssuedStamps(issued.pdf());
        assertEquals(1, detected.size());
        assertTrue(Math.abs(detected.get(0).x() - issuedStamp.x()) < 1f && Math.abs(detected.get(0).y() - issuedStamp.y()) < 1f,
                "the detected frame matches where the stamp was drawn");
        ControlledCopyPdfMarkingService.Marked withStatus = service.applyStatusMarkingWithLayout(
                issued.pdf(), ControlledCopyStatusMarking.defaults("OBSOLETED"), List.of("RECALLED"), List.of("WITHDRAWN", "Recalled"), detected);

        ControlledCopyPdfMarkingService.Placement statusStamp = withStatus.placements().stream().filter(p -> "STAMP".equals(p.kind())).findFirst().orElseThrow();
        assertFalse(overlap(issuedStamp, statusStamp), "the status stamp must not cover the earlier stamp");
    }

    private static byte[] pdfPages(int pages) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.newLineAtOffset(40, 200);
                    content.showText("PAGE " + (i + 1));
                    content.endText();
                }
            }
            document.save(out);
            return out.toByteArray();
        }
    }

    private static ControlledCopyPdfMarkingService.Placement stampOn(ControlledCopyPdfMarkingService.Marked marked, int page) {
        return marked.placements().stream().filter(p -> p.page() == page && "STAMP".equals(p.kind())).findFirst().orElseThrow();
    }

    @Test
    void placementRules_setThePositionPerPage_coverPageAndOthersDiffer() throws IOException {
        ControlledCopyPolicySetting policy = issuedPolicy("TOP_RIGHT");
        policy.setWatermarkEnabled(false);
        policy.setMarkingPlacements(mapper.valueToTree(List.of(
                new MarkingPlacementRule("FIRST", 0.10, 0.10, 20, null, null, null, null),
                new MarkingPlacementRule("OTHERS", 0.60, 0.85, 25, null, null, null, null))));
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");

        ControlledCopyPdfMarkingService.Marked marked = service.applyWithLayout(pdfPages(3), copy, mapper.createObjectNode().put("name", "A"), policy);

        ControlledCopyPdfMarkingService.Placement cover = stampOn(marked, 0);
        ControlledCopyPdfMarkingService.Placement second = stampOn(marked, 1);
        ControlledCopyPdfMarkingService.Placement third = stampOn(marked, 2);
        assertEquals(0.10f * cover.pageWidth(), cover.x(), 1f, "cover page uses the FIRST rule");
        assertEquals(cover.pageHeight() - 0.10f * cover.pageHeight() - cover.height(), cover.y(), 1f);
        assertEquals(0.60f * second.pageWidth(), second.x(), 1f, "pages 2+ use the OTHERS rule");
        assertEquals(second.x(), third.x(), 0.5f);
        assertEquals(0.20f * cover.pageWidth(), cover.width(), 2f, "the width rule is honoured");
    }

    @Test
    void explicitPageList_beatsOthers() throws IOException {
        ControlledCopyPolicySetting policy = issuedPolicy("TOP_RIGHT");
        policy.setWatermarkEnabled(false);
        policy.setMarkingPlacements(mapper.valueToTree(List.of(
                new MarkingPlacementRule("OTHERS", 0.60, 0.85, 25, null, null, null, null),
                new MarkingPlacementRule("3", 0.05, 0.50, 25, null, null, null, null))));
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");

        ControlledCopyPdfMarkingService.Marked marked = service.applyWithLayout(pdfPages(3), copy, mapper.createObjectNode().put("name", "A"), policy);

        assertEquals(0.05f * stampOn(marked, 2).pageWidth(), stampOn(marked, 2).x(), 1f);
        assertEquals(0.60f * stampOn(marked, 1).pageWidth(), stampOn(marked, 1).x(), 1f);
    }

    @Test
    void statusStamp_isMovedAndFlagged_whenItsChosenSpotIsTakenByAnotherStamp() throws IOException {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        ControlledCopyPdfMarkingService.Marked issued = service.applyWithLayout(
                pdf(PDRectangle.A4), copy, mapper.createObjectNode().put("name", "A"), issuedPolicy("TOP_RIGHT"));

        ControlledCopyPdfMarkingService.Marked withStatus = service.applyStatusMarkingWithLayout(
                issued.pdf(), ControlledCopyStatusMarking.defaults("OBSOLETED"), List.of("RECALLED"), List.of("WITHDRAWN"), issued.placements());

        assertTrue(stampOn(withStatus, 0).adjusted(), "the configured spot collided, so the stamp was moved");
        // A spot that is free is left alone.
        ControlledCopyStatusMarking elsewhere = new ControlledCopyStatusMarking(null, null, null, null, null, null, null, null, null, null, null, null,
                "BOTTOM_LEFT", null, null, null, null, null, null, null, null, null, null).mergedOver(ControlledCopyStatusMarking.defaults("OBSOLETED"));
        ControlledCopyPdfMarkingService.Marked free = service.applyStatusMarkingWithLayout(
                issued.pdf(), elsewhere, List.of("RECALLED"), List.of("WITHDRAWN"), issued.placements());
        assertFalse(stampOn(free, 0).adjusted());
    }

    @Test
    void statusWatermark_neverOverlapsTheIssuedWatermark() throws IOException {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        ControlledCopyPdfMarkingService.Marked issued = service.applyWithLayout(
                pdf(PDRectangle.A4), copy, mapper.createObjectNode().put("name", "A"), issuedPolicy("TOP_RIGHT"));
        ControlledCopyStatusMarking status = patch(null, false, null, null).mergedOver(ControlledCopyStatusMarking.defaults("OBSOLETED"));

        ControlledCopyPdfMarkingService.Marked withStatus = service.applyStatusMarkingWithLayout(
                issued.pdf(), status, List.of("RECALLED BY DOCUMENT CONTROL", "Withdrawn 27/09/2026"), List.of(), issued.placements());

        ControlledCopyPdfMarkingService.Placement issuedWatermark = issued.placements().stream().filter(p -> "WATERMARK".equals(p.kind())).findFirst().orElseThrow();
        ControlledCopyPdfMarkingService.Placement statusWatermark = withStatus.placements().stream().filter(p -> "WATERMARK".equals(p.kind())).findFirst().orElseThrow();
        assertFalse(statusWatermark.overlaps(issuedWatermark, 0f), "two watermarks must not overlap");
        assertTrue(statusWatermark.adjusted());
    }

    @Test
    void placementRuleValidation_recognisesPageSelectors() {
        assertTrue(MarkingPlacementRule.validPages("ALL"));
        assertTrue(MarkingPlacementRule.validPages("first"));
        assertTrue(MarkingPlacementRule.validPages("3, 5-7, last"));
        assertFalse(MarkingPlacementRule.validPages("abc"));
        assertFalse(MarkingPlacementRule.validPages("1-"));
        assertFalse(MarkingPlacementRule.validPages(""));
        assertTrue(new MarkingPlacementRule("3,5-7,LAST", null, null, null, null, null, null, null).matches(6, 9));
        assertTrue(new MarkingPlacementRule("3,5-7,LAST", null, null, null, null, null, null, null).matches(9, 9));
        assertFalse(new MarkingPlacementRule("3,5-7,LAST", null, null, null, null, null, null, null).matches(4, 9));
    }

    @Test
    void withoutIssuedMarks_theStatusStampKeepsItsConfiguredCorner() throws IOException {
        ControlledCopyStatusMarking status = ControlledCopyStatusMarking.defaults("OBSOLETED");

        ControlledCopyPdfMarkingService.Marked marked = service.applyStatusMarkingWithLayout(
                pdf(PDRectangle.A4), status, List.of("RECALLED"), List.of("WITHDRAWN"), List.of());

        ControlledCopyPdfMarkingService.Placement stamp = marked.placements().stream().filter(p -> "STAMP".equals(p.kind())).findFirst().orElseThrow();
        assertTrue(stamp.x() + stamp.width() > stamp.pageWidth() * 0.8f, "top right");
        assertTrue(stamp.y() > stamp.pageHeight() * 0.8f, "top right");
    }

    @Test
    void layoutRoundTripsThroughJson() throws IOException {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        ControlledCopyPdfMarkingService.Marked issued = service.applyWithLayout(
                pdf(PDRectangle.A4), copy, mapper.createObjectNode().put("name", "A"), issuedPolicy("TOP_LEFT"));

        assertEquals(issued.placements(), service.fromJson(service.toJson(issued.placements())));
    }

    @Test
    void statusWatermark_movesOffTheIssuedWatermark() throws IOException {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        ControlledCopyPdfMarkingService.Marked issued = service.applyWithLayout(
                pdf(PDRectangle.A4), copy, mapper.createObjectNode().put("name", "A"), issuedPolicy("TOP_RIGHT"));
        ControlledCopyStatusMarking status = patch(null, false, null, null).mergedOver(ControlledCopyStatusMarking.defaults("OBSOLETED"));

        byte[] alone = service.applyStatusMarking(issued.pdf(), status, List.of("WATERMARK TEXT"), List.of(), List.of());
        byte[] separated = service.applyStatusMarking(issued.pdf(), status, List.of("WATERMARK TEXT"), List.of(), issued.placements());

        // With an issued watermark present the status watermark is drawn elsewhere, so the two renderings differ.
        assertFalse(java.util.Arrays.equals(alone, separated));
    }

    @Test
    void bothDisabled_returnTheOriginalBytesUntouched() throws IOException {
        byte[] original = pdf(PDRectangle.A4);
        ControlledCopyStatusMarking off = patch(false, false, null, null).mergedOver(ControlledCopyStatusMarking.defaults("OBSOLETED"));

        assertArrayEquals(original, service.applyStatusMarking(original, off, List.of("X"), List.of("Y")));
    }

    @Test
    void stampStaysInsideASmallPage_evenWithLargeSizeAndLargeMargin() throws IOException {
        ControlledCopyPolicySetting policy = new ControlledCopyPolicySetting();
        policy.setWatermarkEnabled(false);
        policy.setStampSize("LARGE");
        policy.setStampMarginMm(40);
        policy.setStampPosition("BOTTOM_RIGHT");
        policy.setStampText("CONTROLLED COPY FOR QUALITY ASSURANCE ONLY");
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");

        byte[] marked = service.apply(pdf(PDRectangle.A6), copy, mapper.createObjectNode().put("name", "A"), policy);

        List<float[]> glyphs = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(marked)) {
            PDFTextStripper stripper = new PDFTextStripper() {
                @Override
                protected void writeString(String string, List<TextPosition> positions) {
                    if (string.contains("CONTROLLED")) {
                        for (TextPosition position : positions) {
                            glyphs.add(new float[] {position.getXDirAdj(), position.getYDirAdj(), position.getPageWidth(), position.getPageHeight()});
                        }
                    }
                }
            };
            stripper.getText(document);
        }
        assertFalse(glyphs.isEmpty());
        for (float[] glyph : glyphs) {
            assertTrue(glyph[0] >= 0 && glyph[0] <= glyph[2], "x outside the page: " + glyph[0] + " of " + glyph[2]);
            assertTrue(glyph[1] >= 0 && glyph[1] <= glyph[3], "y outside the page: " + glyph[1] + " of " + glyph[3]);
        }
    }
}
