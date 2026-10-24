package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Draws the administrator's DRAFT stamp/watermark on one sample paper page (the same page for every document: the marks do not depend
 * on which document is copied) so they can see, before saving, how issued,
 * withdrawn and cancelled copies will look. Everything is done by the server with the same drawing code used for real copies, on
 * sample data (no real recipient or copy), and nothing is stored.
 */
@Service
public class ControlledCopyMarkingPreviewService {

    private static final ZoneId ZONE = DateTimeFormatUtils.ZONE;
    // Rendered at roughly 2x a typical screen's 96 DPI so the preview stays sharp on high-DPI (retina)
    // displays even when stretched to fill a wide column; PNG compresses the mostly-white page well
    // enough that the extra pixels cost little on the wire.
    private static final int PREVIEW_DPI = 192;

    private final ControlledCopyPolicyService policyService;
    private final ControlledCopyPdfMarkingService markingService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** The one-page sample paper the marks are drawn on, shared with {@link UncontrolledCopyMarkingPreviewService}. */
    public record CachedBase(byte[] pdf, String note, long storedAt) {
    }

    public ControlledCopyMarkingPreviewService(
            ControlledCopyPolicyService policyService,
            ControlledCopyPdfMarkingService markingService
    ) {
        this.policyService = policyService;
        this.markingService = markingService;
    }

    public ControlledCopyMarkingPreviewResponse preview(ControlledCopyMarkingPreviewRequest request) {
        String scenario = request.scenario() == null ? "ISSUED" : request.scenario().trim().toUpperCase();
        if (!List.of("ISSUED", "OBSOLETED", "CLOSED_CANCELLED").contains(scenario)) {
            throw new IllegalArgumentException("Unknown preview scenario");
        }

        ControlledCopyPolicySetting draft = policyService.draftFrom(new ControlledCopyPolicyRequest(
                request.distributionSecurity(), null, null, request.marking(), request.statusMarking(), null, null, null));
        CachedBase base = samplePaper();

        ControlledCopyRecord sample = sampleCopy();
        JsonNode recipient = objectMapper.createObjectNode().put("name", "Nguyen Van A");

        List<ControlledCopyPdfMarkingService.Placement> issuedMarks = new ArrayList<>();
        List<ControlledCopyPdfMarkingService.Placement> statusMarks = new ArrayList<>();
        byte[] finalPdf;
        if ("CLOSED_CANCELLED".equals(scenario)) {
            // A cancelled request was never issued, so it carries no issue-time marks.
            ControlledCopyStatusMarking config = policyService.statusMarkingFor(draft, scenario);
            ControlledCopyPdfMarkingService.StatusLines lines = markingService.statusLines(config, "Request cancelled", cancelledDate());
            ControlledCopyPdfMarkingService.Marked status = markingService.applyStatusMarkingWithLayout(
                    base.pdf(), config, lines.watermark(), lines.stamp(), List.of());
            finalPdf = status.pdf();
            statusMarks.addAll(status.placements());
        } else {
            ControlledCopyPdfMarkingService.Marked issued = markingService.isMarkingEnabled(draft)
                    ? markingService.applyWithLayout(base.pdf(), sample, recipient, draft)
                    : new ControlledCopyPdfMarkingService.Marked(base.pdf(), List.of());
            if (draft.isQrCodeEnabled()) {
                // A paper copy carries a scan code; show where it will land, with a throwaway token.
                ControlledCopyPdfMarkingService.Marked withCode = markingService.applyScanCode(
                        issued.pdf(),
                        ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(ControlledCopyScanCodeService.newToken())),
                        sample.getControlledCopyNumber(),
                        draft.getQrCodePosition(), draft.getQrCodeX(), draft.getQrCodeY(), draft.getQrCodeSizeMm(), draft.getStampMarginMm(),
                        issued.placements());
                List<ControlledCopyPdfMarkingService.Placement> all = new ArrayList<>(issued.placements());
                all.addAll(withCode.placements());
                issued = new ControlledCopyPdfMarkingService.Marked(withCode.pdf(), all);
            }
            finalPdf = issued.pdf();
            issuedMarks.addAll(issued.placements());
            if ("OBSOLETED".equals(scenario)) {
                ControlledCopyStatusMarking config = policyService.statusMarkingFor(draft, scenario);
                String reason = ControlledCopyWithdrawalNoticeService.reasonLabel(
                        StringUtils.hasText(request.reason()) ? request.reason() : "RECALLED");
                ControlledCopyPdfMarkingService.StatusLines lines = markingService.statusLines(config, reason, withdrawnDate());
                ControlledCopyPdfMarkingService.Marked status = markingService.applyStatusMarkingWithLayout(
                        finalPdf, config, lines.watermark(), lines.stamp(), issued.placements());
                finalPdf = status.pdf();
                statusMarks.addAll(status.placements());
            }
        }

        return response(finalPdf, base, 0, issuedMarks, statusMarks);
    }

    /** Renders {@code pageIndex} of the marked PDF to PNG plus the mark boxes/warnings. Shared with the Uncontrolled Copy preview. */
    public ControlledCopyMarkingPreviewResponse response(byte[] pdf, CachedBase base, int pageIndex,
                                                          List<ControlledCopyPdfMarkingService.Placement> issuedMarks,
                                                          List<ControlledCopyPdfMarkingService.Placement> statusMarks) {
        List<ControlledCopyMarkingPreviewResponse.MarkBox> boxes = new ArrayList<>();
        List<ControlledCopyMarkingPreviewResponse.Warning> warnings = new ArrayList<>();
        float[] pageSize = {0, 0};
        collect("Issued", issuedMarks, pageIndex, boxes, warnings, pageSize);
        collect("Status", statusMarks, pageIndex, boxes, warnings, pageSize);
        float pageWidth = pageSize[0];
        float pageHeight = pageSize[1];
        try (PDDocument document = Loader.loadPDF(pdf)) {
            int index = Math.min(pageIndex, document.getNumberOfPages() - 1);
            BufferedImage image = new PDFRenderer(document).renderImageWithDPI(index, PREVIEW_DPI, ImageType.RGB);
            if (pageWidth == 0) {
                pageWidth = image.getWidth() * 72f / PREVIEW_DPI;
                pageHeight = image.getHeight() * 72f / PREVIEW_DPI;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return new ControlledCopyMarkingPreviewResponse(
                    Base64.getEncoder().encodeToString(out.toByteArray()), pageWidth, pageHeight, boxes, warnings, base.note());
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to draw the marking preview", ex);
        }
    }

    private static void collect(String origin, List<ControlledCopyPdfMarkingService.Placement> marks, int pageIndex,
                                List<ControlledCopyMarkingPreviewResponse.MarkBox> boxes,
                                List<ControlledCopyMarkingPreviewResponse.Warning> warnings, float[] pageSize) {
        for (ControlledCopyPdfMarkingService.Placement placement : marks) {
            if (placement.page() != pageIndex) {
                continue;
            }
            pageSize[0] = placement.pageWidth();
            pageSize[1] = placement.pageHeight();
            if (ControlledCopyPdfMarkingService.KIND_QR.equals(placement.kind())) {
                boxes.add(new ControlledCopyMarkingPreviewResponse.MarkBox(origin + " QR code", placement.kind(), placement.x(), placement.y(),
                        placement.width(), placement.height(), placement.angle(), placement.adjusted()));
                if (placement.adjusted()) {
                    warnings.add(new ControlledCopyMarkingPreviewResponse.Warning("QR_MOVED",
                            "The QR code would overlap the stamp or the watermark where you put it, so it was moved to the nearest free place."));
                }
                continue;
            }
            boolean stamp = "STAMP".equals(placement.kind());
            String layer = origin + (stamp ? " stamp" : " watermark");
            boxes.add(new ControlledCopyMarkingPreviewResponse.MarkBox(layer, placement.kind(), placement.x(), placement.y(),
                    placement.width(), placement.height(), placement.angle(), placement.adjusted()));
            if (placement.adjusted()) {
                // The chosen spot was taken by another mark of the same kind, so the server moved this one. Tell the administrator so
                // they can choose a position that does not depend on that.
                warnings.add(new ControlledCopyMarkingPreviewResponse.Warning(stamp ? "STAMP_OVERLAP" : "WATERMARK_OVERLAP",
                        "The " + layer.toLowerCase() + " would overlap the other "
                                + (stamp ? "stamp" : "watermark") + " where you put it, so it was moved"
                                + (stamp ? "." : " and made smaller.") + " Drag it to a free place."));
            }
        }
    }

    private static volatile CachedBase sample;

    /**
     * One A4 sample page: a title, a document-number line and grey bars standing in for text, so the administrator can judge where
     * a stamp, watermark or QR code lands relative to content. It is the same for every document.
     */
    public CachedBase samplePaper() {
        CachedBase current = sample;
        if (current == null) {
            current = new CachedBase(buildSamplePage(), null, System.currentTimeMillis());
            sample = current;
        }
        return current;
    }

    private static byte[] buildSamplePage() {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            org.apache.pdfbox.pdmodel.PDPage page = new org.apache.pdfbox.pdmodel.PDPage(org.apache.pdfbox.pdmodel.common.PDRectangle.A4);
            document.addPage(page);
            float width = page.getMediaBox().getWidth();
            float height = page.getMediaBox().getHeight();
            float left = 56f;
            org.apache.pdfbox.pdmodel.font.PDType1Font bold = new org.apache.pdfbox.pdmodel.font.PDType1Font(
                    org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA_BOLD);
            org.apache.pdfbox.pdmodel.font.PDType1Font regular = new org.apache.pdfbox.pdmodel.font.PDType1Font(
                    org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA);
            try (org.apache.pdfbox.pdmodel.PDPageContentStream content = new org.apache.pdfbox.pdmodel.PDPageContentStream(document, page)) {
                content.setNonStrokingColor(0.15f, 0.15f, 0.15f);
                content.beginText();
                content.setFont(bold, 18);
                content.newLineAtOffset(left, height - 80);
                content.showText("SAMPLE DOCUMENT");
                content.endText();
                content.beginText();
                content.setFont(regular, 10);
                content.newLineAtOffset(left, height - 98);
                content.showText("Document No.: SOP.0000    Revision: 1.0    Page 1");
                content.endText();
                content.setStrokingColor(0.6f, 0.6f, 0.6f);
                content.moveTo(left, height - 108);
                content.lineTo(width - left, height - 108);
                content.stroke();
                content.setNonStrokingColor(0.86f, 0.86f, 0.86f);
                float y = height - 140;
                int row = 0;
                while (y > 80) {
                    // A paragraph of bars of slightly different lengths, then a gap, like running text.
                    float barWidth = (width - 2 * left) * (row % 6 == 5 ? 0.45f : 0.82f + 0.18f * ((row * 7) % 5) / 4f);
                    content.addRect(left, y, barWidth, 5f);
                    content.fill();
                    y -= 15f;
                    row++;
                    if (row % 6 == 0) {
                        y -= 12f;
                    }
                }
            }
            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to prepare the sample page for the preview", ex);
        }
    }

    private static ControlledCopyRecord sampleCopy() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.10110.001");
        copy.setExpiryDate(Instant.now().plus(90, ChronoUnit.DAYS));
        return copy;
    }

    private static String withdrawnDate() {
        return "Withdrawn " + DateTimeFormatUtils.formatDate(LocalDate.now(ZONE));
    }

    private static String cancelledDate() {
        return "Cancelled " + DateTimeFormatUtils.formatDate(LocalDate.now(ZONE));
    }
}
