package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.PublishingTemplate;
import com.eqms.repository.PublishingTemplateRepository;
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
 * Draws the administrator's DRAFT stamp/watermark on a page of a Publishing Template so they can see, before saving, how issued,
 * withdrawn and cancelled copies will look. Everything is done by the server with the same drawing code used for real copies, on
 * sample data (no real recipient or copy), and nothing is stored.
 */
@Service
public class ControlledCopyMarkingPreviewService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    // Rendered at roughly 2x a typical screen's 96 DPI so the preview stays sharp on high-DPI (retina)
    // displays even when stretched to fill a wide column; PNG compresses the mostly-white page well
    // enough that the extra pixels cost little on the wire.
    private static final int PREVIEW_DPI = 192;
    private static final long CACHE_TTL_MS = 10 * 60 * 1000L;
    private static final int CACHE_MAX_ENTRIES = 12;

    private final ControlledCopyPolicyService policyService;
    private final ControlledCopyPdfMarkingService markingService;
    private final PublishingTemplatePreviewService templatePreviewService;
    private final PublishingTemplateRepository templateRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Two-page base documents (cover page, then a body page), kept briefly: producing one asks OnlyOffice to convert the template. */
    private final Map<String, CachedBase> cache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, CachedBase> eldest) {
            return size() > CACHE_MAX_ENTRIES;
        }
    };

    private record CachedBase(byte[] pdf, String note, long storedAt) {
    }

    public ControlledCopyMarkingPreviewService(
            ControlledCopyPolicyService policyService,
            ControlledCopyPdfMarkingService markingService,
            PublishingTemplatePreviewService templatePreviewService,
            PublishingTemplateRepository templateRepository
    ) {
        this.policyService = policyService;
        this.markingService = markingService;
        this.templatePreviewService = templatePreviewService;
        this.templateRepository = templateRepository;
    }

    public ControlledCopyMarkingPreviewResponse preview(ControlledCopyMarkingPreviewRequest request) {
        String scenario = request.scenario() == null ? "ISSUED" : request.scenario().trim().toUpperCase();
        if (!List.of("ISSUED", "OBSOLETED", "CLOSED_CANCELLED").contains(scenario)) {
            throw new IllegalArgumentException("Unknown preview scenario");
        }
        boolean bodyPage = "BODY".equalsIgnoreCase(request.pageKind());
        String layout = "landscape".equalsIgnoreCase(request.layout()) ? "landscape" : "portrait";

        ControlledCopyPolicySetting draft = policyService.draftFrom(new ControlledCopyPolicyRequest(
                request.distributionSecurity(), null, null, request.marking(), request.statusMarking(), null, null, null));
        CachedBase base = baseDocument(request.templateId(), layout);

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

        int pageIndex = bodyPage ? 1 : 0;
        return response(finalPdf, base, pageIndex, issuedMarks, statusMarks);
    }

    private ControlledCopyMarkingPreviewResponse response(byte[] pdf, CachedBase base, int pageIndex,
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

    private CachedBase baseDocument(String templateId, String layout) {
        PublishingTemplate template = resolveTemplate(templateId);
        String key = template.getId() + "|" + layout + "|" + template.getUpdatedAt();
        synchronized (cache) {
            CachedBase cached = cache.get(key);
            if (cached != null && System.currentTimeMillis() - cached.storedAt() < CACHE_TTL_MS) {
                return cached;
            }
        }
        CachedBase created = buildBase(template.getId(), layout);
        synchronized (cache) {
            cache.put(key, created);
        }
        return created;
    }

    private PublishingTemplate resolveTemplate(String templateId) {
        if (StringUtils.hasText(templateId)) {
            try {
                return templateRepository.findById(UUID.fromString(templateId.trim()))
                        .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Publishing template not found");
            }
        }
        return templateRepository.findByStatusOrderByTemplateNameAsc("ACTIVE").stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Choose a Publishing Template to preview on"));
    }

    /** Page 1 from the template's cover, page 2 from its body (the cover again when the template has no body). */
    private CachedBase buildBase(UUID templateId, String layout) {
        try {
            byte[] cover = templatePreviewService.getComponentPreviewPdf(templateId, "cover", layout, null);
            byte[] body = null;
            String note = null;
            try {
                body = templatePreviewService.getComponentPreviewPdf(templateId, "body", layout, null);
            } catch (RuntimeException | IOException ex) {
                note = "This template has no body page; page 2 onwards is shown with the cover page.";
            }
            try (PDDocument out = new PDDocument();
                 PDDocument coverDoc = Loader.loadPDF(cover);
                 PDDocument bodyDoc = body == null ? null : Loader.loadPDF(body);
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                out.importPage(coverDoc.getPage(0));
                out.importPage(bodyDoc != null && bodyDoc.getNumberOfPages() > 0 ? bodyDoc.getPage(0) : coverDoc.getPage(0));
                out.save(bytes);
                return new CachedBase(bytes.toByteArray(), note, System.currentTimeMillis());
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to prepare the template page for the preview", ex);
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
