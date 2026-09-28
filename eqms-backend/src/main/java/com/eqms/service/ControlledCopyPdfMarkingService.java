package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.dto.controlledcopypolicy.MarkingPlacementRule;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSNumber;
import org.apache.pdfbox.pdfparser.PDFStreamParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.common.PDStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Burns the administrator-configured stamp (a framed box) and watermark (diagonal text) into the PDF of a Controlled Copy
 * when it is issued. It runs on the server as part of composing the copy, so the marks are part of the stored, immutable
 * file that is previewed, downloaded and printed. A failure here must fail the distribution rather than issue an unmarked copy.
 *
 * <p>Where a mark goes can be set per page (see {@link MarkingPlacementRule}). Two stamps, or two watermarks, are never drawn
 * on top of each other: when a copy that already carries marks gets a status stamp/watermark, the new one is moved clear of the
 * old one. A mark covering the page's own text or graphics is not a problem and is not checked.</p>
 */
@Service
public class ControlledCopyPdfMarkingService {

    /** Font families an administrator may pick for a stamp/watermark; keys are the values stored/validated on the policy. */
    private static final java.util.Map<String, String> FONT_RESOURCES = java.util.Map.of(
            "NOTO_SANS", "/fonts/NotoSans-Bold.ttf",
            "NOTO_SERIF", "/fonts/NotoSerif-Bold.ttf",
            "ROBOTO_MONO", "/fonts/RobotoMono-Bold.ttf",
            "OSWALD", "/fonts/Oswald-Bold.ttf");
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final float POINTS_PER_MM = 72f / 25.4f;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    /** Minimum clear space kept between two stamps, or two watermarks, in points. */
    private static final float MARK_GAP = 6f;

    public boolean isMarkingEnabled(ControlledCopyPolicySetting policy) {
        return policy != null && (policy.isStampEnabled() || policy.isWatermarkEnabled());
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Records
    // ------------------------------------------------------------------------------------------------------------------

    /**
     * Where a mark was drawn on a page, in the page's visual coordinates (points, origin bottom-left). A watermark is the
     * unrotated block centred on its centre and rotated by {@code angle} degrees. {@code adjusted} is true when the configured
     * position would have overlapped another mark and was moved. {@code page} -1 with a page size of 1x1 is an estimate that
     * applies to every page, in fractions of the page (used for copies whose real layout was never recorded).
     */
    public record Placement(int page, String kind, float x, float y, float width, float height, float pageWidth, float pageHeight,
                            float angle, boolean adjusted) {

        Placement scaledTo(float visualWidth, float visualHeight) {
            if (pageWidth != 1f || pageHeight != 1f || page != -1) {
                return this;
            }
            return new Placement(page, kind, x * visualWidth, y * visualHeight, width * visualWidth, height * visualHeight,
                    visualWidth, visualHeight, angle, adjusted);
        }

        public boolean overlaps(Placement other, float gap) {
            return orientedOverlap(x + width / 2f, y + height / 2f, width / 2f + gap, height / 2f + gap, Math.toRadians(angle),
                    other.x + other.width / 2f, other.y + other.height / 2f, other.width / 2f, other.height / 2f, Math.toRadians(other.angle));
        }
    }

    /** The marked PDF and where its marks were drawn. */
    public record Marked(byte[] pdf, List<Placement> placements) {
    }

    /** The texts of a status watermark and status stamp (the first line of each is its title). */
    public record StatusLines(List<String> watermark, List<String> stamp) {
    }

    /** The size and position a stamp takes on a page, before anything is drawn. */
    private record StampBox(float x, float y, float width, float height, float scale, float titleSize, float subSize,
                            float padding, List<String> lines) {
        StampBox at(float newX, float newY) {
            return new StampBox(newX, newY, width, height, scale, titleSize, subSize, padding, lines);
        }

        boolean inside(float pageWidth, float pageHeight) {
            return x >= -0.5f && y >= -0.5f && x + width <= pageWidth + 0.5f && y + height <= pageHeight + 0.5f;
        }

        Placement asPlacement(int page, float pageWidth, float pageHeight, boolean adjusted) {
            return new Placement(page, "STAMP", x, y, width, height, pageWidth, pageHeight, 0f, adjusted);
        }
    }

    /** The size, position and angle a watermark takes on a page, before anything is drawn. */
    private record WatermarkBox(float centreX, float centreY, float width, float height, float titleSize, float subSize,
                                float angleDegrees, List<String> lines) {
        Placement asPlacement(int page, float pageWidth, float pageHeight, boolean adjusted) {
            return new Placement(page, "WATERMARK", centreX - width / 2f, centreY - height / 2f, width, height, pageWidth, pageHeight,
                    angleDegrees, adjusted);
        }
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Status wording, layout (de)serialisation, legacy detection
    // ------------------------------------------------------------------------------------------------------------------

    /**
     * The wording of the status marks of a withdrawn / cancelled copy: the watermark is the administrator's text (or its
     * stamp's fixed label, e.g. WITHDRAWN/CANCELLED, when blank) and the stamp is its text plus, when enabled, the date.
     * The withdrawal/cancellation reason itself is no longer part of either mark (removed per admin request).
     */
    public StatusLines statusLines(ControlledCopyStatusMarking config, String reason, String dateLabel) {
        List<String> watermark = new ArrayList<>();
        watermark.add(StringUtils.hasText(config.watermarkText()) ? config.watermarkText() : config.stampText());
        if (Boolean.TRUE.equals(config.watermarkShowDate()) && dateLabel != null) {
            watermark.add(dateLabel);
        }
        List<String> stamp = new ArrayList<>();
        stamp.add(config.stampText());
        if (Boolean.TRUE.equals(config.stampShowDate()) && dateLabel != null) {
            stamp.add(dateLabel);
        }
        return new StatusLines(watermark, stamp);
    }

    public JsonNode toJson(List<Placement> placements) {
        return MAPPER.valueToTree(placements);
    }

    public List<Placement> fromJson(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        return MAPPER.convertValue(node, new TypeReference<List<Placement>>() { });
    }

    /**
     * An estimate of the watermark a copy carries when its real layout was not recorded (issued before layouts were kept): a
     * diagonal band across the middle of every page. It only steers a later status watermark away from that area.
     */
    public Placement legacyWatermarkEstimate() {
        return new Placement(-1, "WATERMARK", 0.19f, 0.455f, 0.62f, 0.09f, 1f, 1f, 35f, false);
    }

    /**
     * Finds the stamp frames drawn by this service on an already marked PDF: the last content stream of a page ends with the
     * frame ({@code re} ... {@code S}) of the stamp. Used for copies issued before the layout was recorded, so a status stamp still
     * avoids the stamp they carry. Pages that are rotated are skipped.
     */
    public List<Placement> detectIssuedStamps(byte[] pdf) {
        List<Placement> found = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(pdf)) {
            for (int index = 0; index < document.getNumberOfPages(); index++) {
                PDPage page = document.getPage(index);
                if (page.getRotation() % 360 != 0) {
                    continue;
                }
                float[] size = visualSize(page);
                PDRectangle box = page.getCropBox() != null ? page.getCropBox() : page.getMediaBox();
                PDStream last = null;
                Iterator<PDStream> streams = page.getContentStreams();
                while (streams.hasNext()) {
                    last = streams.next();
                }
                if (last == null) {
                    continue;
                }
                Placement frame = lastFrame(last.toByteArray(), index, size[0], size[1], box.getLowerLeftX(), box.getLowerLeftY());
                if (frame != null) {
                    found.add(frame);
                }
            }
        } catch (IOException | RuntimeException ex) {
            return List.of();
        }
        return found;
    }

    private static Placement lastFrame(byte[] content, int pageIndex, float visualWidth, float visualHeight, float originX, float originY)
            throws IOException {
        List<Object> tokens = new PDFStreamParser(content).parse();
        List<COSBase> operands = new ArrayList<>();
        float[] pendingRect = null;
        float translateX = originX;
        float translateY = originY;
        Placement result = null;
        for (Object token : tokens) {
            if (!(token instanceof Operator operator)) {
                if (token instanceof COSBase base) {
                    operands.add(base);
                }
                continue;
            }
            String name = operator.getName();
            if ("cm".equals(name) && operands.size() == 6 && number(operands, 0) == 1f && number(operands, 3) == 1f
                    && number(operands, 1) == 0f && number(operands, 2) == 0f) {
                translateX += number(operands, 4);
                translateY += number(operands, 5);
            } else if ("re".equals(name) && operands.size() == 4) {
                pendingRect = new float[] {number(operands, 0), number(operands, 1), number(operands, 2), number(operands, 3)};
            } else if (("S".equals(name) || "s".equals(name)) && pendingRect != null) {
                float w = pendingRect[2];
                float h = pendingRect[3];
                if (w > 0 && h > 0 && w <= visualWidth * 0.4f && h <= visualHeight * 0.4f) {
                    result = new Placement(pageIndex, "STAMP", pendingRect[0] + translateX - originX, pendingRect[1] + translateY - originY,
                            w, h, visualWidth, visualHeight, 0f, false);
                }
                pendingRect = null;
            } else if ("f".equals(name) || "n".equals(name) || "B".equals(name)) {
                pendingRect = null;
            }
            operands.clear();
        }
        return result;
    }

    private static float number(List<COSBase> operands, int index) {
        return operands.get(index) instanceof COSNumber n ? n.floatValue() : Float.NaN;
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Public drawing entry points
    // ------------------------------------------------------------------------------------------------------------------

    public byte[] apply(byte[] pdf, ControlledCopyRecord copy, JsonNode recipient, ControlledCopyPolicySetting policy) {
        return applyWithLayout(pdf, copy, recipient, policy).pdf();
    }

    /** Same as {@link #apply} but also reports where each mark was drawn. */
    public Marked applyWithLayout(byte[] pdf, ControlledCopyRecord copy, JsonNode recipient, ControlledCopyPolicySetting policy) {
        return render(pdf, policy, stampLines(policy, copy, recipient), watermarkLines(policy, copy, recipient), List.of());
    }

    /**
     * A red diagonal status text over every page (for example RECALLED, or PREVIEW - NOT ISSUED), drawn on a copy of the PDF
     * that is being viewed. The stored file is never changed.
     */
    public byte[] applyStatusWatermark(byte[] pdf, List<String> lines) {
        ControlledCopyPolicySetting overlay = new ControlledCopyPolicySetting();
        overlay.setStampEnabled(false);
        overlay.setWatermarkEnabled(true);
        overlay.setWatermarkColor("#C00000");
        overlay.setWatermarkLayer("ABOVE");
        overlay.setWatermarkOpacityPercent(35);
        overlay.setWatermarkAngleDegrees(35);
        overlay.setWatermarkPages("ALL");
        return render(pdf, overlay, List.of(), lines, List.of()).pdf();
    }

    /**
     * Stamp and watermark of a withdrawn / cancelled copy, drawn from the administrator's per-status configuration on a copy of the bytes
     * being viewed. {@code watermarkLines} / {@code stampLines} are the already-resolved texts (the first line is the title).
     */
    public byte[] applyStatusMarking(byte[] pdf, ControlledCopyStatusMarking config, List<String> watermarkLines, List<String> stampLines) {
        return applyStatusMarking(pdf, config, watermarkLines, stampLines, List.of());
    }

    /**
     * As above, but the marks the copy already carries (from when it was issued) are kept and the new ones are placed clear of
     * them: a status stamp never overlaps an issued stamp, and a status watermark never overlaps an issued watermark.
     */
    public byte[] applyStatusMarking(byte[] pdf, ControlledCopyStatusMarking config, List<String> watermarkLines, List<String> stampLines,
                                     List<Placement> existingMarks) {
        return applyStatusMarkingWithLayout(pdf, config, watermarkLines, stampLines, existingMarks).pdf();
    }

    /** As above, also reporting where the new marks were drawn. */
    public Marked applyStatusMarkingWithLayout(byte[] pdf, ControlledCopyStatusMarking config, List<String> watermarkLines,
                                               List<String> stampLines, List<Placement> existingMarks) {
        ControlledCopyPolicySetting overlay = new ControlledCopyPolicySetting();
        overlay.setWatermarkEnabled(Boolean.TRUE.equals(config.watermarkEnabled()) && !watermarkLines.isEmpty());
        overlay.setWatermarkLayer(config.watermarkLayer());
        overlay.setWatermarkColor(config.watermarkColor());
        overlay.setWatermarkOpacityPercent(config.watermarkOpacityPercent());
        overlay.setWatermarkAngleDegrees(config.watermarkAngleDegrees());
        overlay.setWatermarkPages(config.watermarkPages());
        overlay.setWatermarkFontFamily(config.watermarkFontFamily());
        overlay.setStampEnabled(Boolean.TRUE.equals(config.stampEnabled()) && !stampLines.isEmpty());
        overlay.setStampColor(config.stampColor());
        overlay.setStampPosition(config.stampPosition());
        overlay.setStampMarginMm(config.stampMarginMm());
        overlay.setStampSize(config.stampSize());
        overlay.setStampOpacityPercent(config.stampOpacityPercent());
        overlay.setStampPages(config.stampPages());
        overlay.setStampFontFamily(config.stampFontFamily());
        overlay.setMarkingPlacements(config.placements() == null ? null : MAPPER.valueToTree(config.placements()));
        if (!overlay.isWatermarkEnabled() && !overlay.isStampEnabled()) {
            return new Marked(pdf, List.of());
        }
        return render(pdf, overlay, stampLines, watermarkLines, existingMarks);
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------------------------------------------------------

    private Marked render(byte[] pdf, ControlledCopyPolicySetting policy, List<String> stampLines, List<String> watermarkLines,
                          List<Placement> obstacles) {
        if (pdf == null || pdf.length == 0) {
            throw new IllegalStateException("There is no PDF to mark for this controlled copy");
        }
        List<MarkingPlacementRule> rules = rulesOf(policy.getMarkingPlacements());
        try (PDDocument document = Loader.loadPDF(pdf); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            java.util.Map<String, PDFont> loadedFonts = new java.util.HashMap<>();
            PDFont stampFont = loadFont(document, policy.getStampFontFamily(), loadedFonts);
            PDFont watermarkFont = loadFont(document, policy.getWatermarkFontFamily(), loadedFonts);
            List<Placement> placements = new ArrayList<>();
            int pageCount = document.getNumberOfPages();
            for (int index = 0; index < pageCount; index++) {
                boolean stamp = policy.isStampEnabled() && appliesTo(policy.getStampPages(), index);
                boolean watermark = policy.isWatermarkEnabled() && appliesTo(policy.getWatermarkPages(), index);
                if (!stamp && !watermark) {
                    continue;
                }
                PDPage page = document.getPage(index);
                float[] size = visualSize(page);
                MarkingPlacementRule rule = ruleFor(rules, index + 1, pageCount);
                List<Placement> stampObstacles = new ArrayList<>();
                List<Placement> watermarkObstacles = new ArrayList<>();
                for (Placement o : obstacles) {
                    if (o.page() == index || o.page() == -1) {
                        Placement concrete = o.scaledTo(size[0], size[1]);
                        ("STAMP".equals(concrete.kind()) ? stampObstacles : watermarkObstacles).add(concrete);
                    }
                }

                StampBox stampBox = null;
                if (stamp) {
                    StampBox wanted = layoutStamp(stampFont, stampLines, policy, size[0], size[1], rule);
                    stampBox = avoidStampOverlap(wanted, stampObstacles, size[0], size[1]);
                    placements.add(stampBox.asPlacement(index, size[0], size[1], moved(wanted, stampBox)));
                }
                WatermarkBox watermarkBox = null;
                if (watermark) {
                    WatermarkBox wanted = layoutWatermark(watermarkFont, watermarkLines, policy, size[0], size[1], rule, 0f, 1f);
                    watermarkBox = avoidWatermarkOverlap(watermarkFont, watermarkLines, policy, size[0], size[1], rule, wanted, watermarkObstacles);
                    placements.add(watermarkBox.asPlacement(index, size[0], size[1],
                            Math.abs(wanted.centreY() - watermarkBox.centreY()) > 0.5f || Math.abs(wanted.width() - watermarkBox.width()) > 0.5f));
                }

                boolean watermarkBehind = watermark && !"ABOVE".equalsIgnoreCase(policy.getWatermarkLayer());
                if (watermarkBehind) {
                    // Behind the page content, so the document's own text stays crisp and readable on top of it.
                    try (PDPageContentStream content = new PDPageContentStream(
                            document, page, PDPageContentStream.AppendMode.PREPEND, true, true)) {
                        applyVisualTransform(content, page);
                        drawWatermark(content, watermarkFont, watermarkBox, policy);
                    }
                }
                boolean watermarkAbove = watermark && !watermarkBehind;
                if (stamp || watermarkAbove) {
                    // On top of the content: the stamp must never be hidden, and neither may a watermark set to ABOVE.
                    try (PDPageContentStream content = new PDPageContentStream(
                            document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                        applyVisualTransform(content, page);
                        if (watermarkAbove) {
                            drawWatermark(content, watermarkFont, watermarkBox, policy);
                        }
                        if (stamp) {
                            drawStamp(content, stampFont, stampBox, policy);
                        }
                    }
                }
            }
            document.save(out);
            return new Marked(out.toByteArray(), placements);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to apply the controlled copy stamp/watermark", ex);
        }
    }

    /** Loads (and caches per document, since a font is embedded and cannot be reused across a different {@link PDDocument}) the
     *  bundled font for {@code family}, falling back to the default family for an unrecognised or missing value. */
    private PDFont loadFont(PDDocument document, String family, java.util.Map<String, PDFont> cache) throws IOException {
        String resolved = FONT_RESOURCES.containsKey(family) ? family : "NOTO_SANS";
        PDFont cached = cache.get(resolved);
        if (cached != null) {
            return cached;
        }
        try (InputStream fontStream = getClass().getResourceAsStream(FONT_RESOURCES.get(resolved))) {
            if (fontStream == null) {
                throw new IllegalStateException("The stamp/watermark font is not available");
            }
            PDFont font = PDType0Font.load(document, fontStream);
            cache.put(resolved, font);
            return font;
        }
    }

    private static boolean moved(StampBox wanted, StampBox actual) {
        return Math.abs(wanted.x() - actual.x()) > 0.5f || Math.abs(wanted.y() - actual.y()) > 0.5f;
    }

    private static List<MarkingPlacementRule> rulesOf(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        return MAPPER.convertValue(node, new TypeReference<List<MarkingPlacementRule>>() { });
    }

    /** The most specific rule written for this page (explicit list > FIRST / OTHERS > ALL), or null. */
    static MarkingPlacementRule ruleFor(List<MarkingPlacementRule> rules, int pageNumber, int pageCount) {
        MarkingPlacementRule best = null;
        for (MarkingPlacementRule rule : rules) {
            if (rule != null && rule.matches(pageNumber, pageCount) && (best == null || rule.specificity() > best.specificity())) {
                best = rule;
            }
        }
        return best;
    }

    private static float[] visualSize(PDPage page) {
        PDRectangle box = page.getCropBox() != null ? page.getCropBox() : page.getMediaBox();
        int rotation = ((page.getRotation() % 360) + 360) % 360;
        return rotation == 90 || rotation == 270 ? new float[] {box.getHeight(), box.getWidth()} : new float[] {box.getWidth(), box.getHeight()};
    }

    private static boolean appliesTo(String pages, int pageIndex) {
        return "ALL".equalsIgnoreCase(pages) || pageIndex == 0;
    }

    private List<String> stampLines(ControlledCopyPolicySetting p, ControlledCopyRecord copy, JsonNode recipient) {
        List<String> lines = new ArrayList<>();
        lines.add(p.getStampText());
        if (p.isStampShowCopyNumber() && StringUtils.hasText(copy.getControlledCopyNumber())) {
            lines.add("No. " + copy.getControlledCopyNumber());
        }
        if (p.isStampShowRecipient()) {
            String name = recipient == null ? "" : recipient.path("name").asText("");
            if (StringUtils.hasText(name)) {
                lines.add(name);
            }
        }
        if (p.isStampShowDistributedDate()) {
            lines.add("Distributed " + DateTimeFormatUtils.formatDate(LocalDate.now(ZONE)));
        }
        if (p.isStampShowExpiryDate() && expiry(copy) != null) {
            lines.add("Valid until " + DateTimeFormatUtils.formatDate(expiry(copy)));
        }
        return lines;
    }

    private List<String> watermarkLines(ControlledCopyPolicySetting p, ControlledCopyRecord copy, JsonNode recipient) {
        List<String> lines = new ArrayList<>();
        lines.add(p.getWatermarkText());
        if (p.isWatermarkCopyNumber() && StringUtils.hasText(copy.getControlledCopyNumber())) {
            lines.add(copy.getControlledCopyNumber());
        }
        if (p.isWatermarkRecipient()) {
            String name = recipient == null ? "" : recipient.path("name").asText("");
            if (StringUtils.hasText(name)) {
                lines.add(name);
            }
        }
        if (p.isWatermarkDistributedDate()) {
            lines.add("Distributed: " + DateTimeFormatUtils.formatDate(LocalDate.now(ZONE)));
        }
        if (p.isWatermarkExpiryDate() && expiry(copy) != null) {
            lines.add("Expires: " + DateTimeFormatUtils.formatDate(expiry(copy)));
        }
        return lines;
    }

    private static LocalDate expiry(ControlledCopyRecord copy) {
        if (copy.getExpiryDate() != null) {
            return copy.getExpiryDate().atZone(ZONE).toLocalDate();
        }
        return copy.getValidUntil();
    }

    /**
     * Makes (0,0) the bottom-left corner of the page AS DISPLAYED, whatever its /Rotate and crop box, and returns the
     * displayed width and height. Marks are then always upright and in the same corner for the reader.
     */
    private static float[] applyVisualTransform(PDPageContentStream content, PDPage page) throws IOException {
        PDRectangle box = page.getCropBox() != null ? page.getCropBox() : page.getMediaBox();
        float w = box.getWidth();
        float h = box.getHeight();
        float x = box.getLowerLeftX();
        float y = box.getLowerLeftY();
        int rotation = ((page.getRotation() % 360) + 360) % 360;
        switch (rotation) {
            case 90 -> {
                content.transform(new Matrix(0, 1, -1, 0, x + w, y));
                return new float[] {h, w};
            }
            case 180 -> {
                content.transform(new Matrix(-1, 0, 0, -1, x + w, y + h));
                return new float[] {w, h};
            }
            case 270 -> {
                content.transform(new Matrix(0, -1, 1, 0, x, y + h));
                return new float[] {h, w};
            }
            default -> {
                content.transform(new Matrix(1, 0, 0, 1, x, y));
                return new float[] {w, h};
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Stamp
    // ------------------------------------------------------------------------------------------------------------------

    private StampBox layoutStamp(PDFont font, List<String> lines, ControlledCopyPolicySetting p, float visualWidth, float visualHeight,
                                 MarkingPlacementRule rule) throws IOException {
        float titleSize = switch (p.getStampSize()) {
            case "SMALL" -> 10f;
            case "LARGE" -> 17f;
            default -> 13f;
        };
        float subSize = titleSize * 0.62f;
        float padding = titleSize * 0.6f;
        List<String> safe = lines.stream().map(line -> printable(font, line)).toList();
        float maxWidth = 0;
        float height = padding * 2;
        for (int i = 0; i < safe.size(); i++) {
            float size = i == 0 ? titleSize : subSize;
            maxWidth = Math.max(maxWidth, textWidth(font, safe.get(i), size));
            height += size * 1.25f;
        }
        float width = maxWidth + padding * 2;
        boolean placed = rule != null && rule.hasStampPosition();
        // never let the stamp cover more than a third of the page width, unless the administrator gave it a width
        float widthLimit = placed && rule.stampWidthPercent() != null ? visualWidth * rule.stampWidthPercent() / 100f : visualWidth / 3f;
        float scale = placed && rule.stampWidthPercent() != null ? widthLimit / width : Math.min(1f, widthLimit / width);
        width *= scale;
        height *= scale;
        // never taller than a third of the page either (many lines on a small page)
        float heightScale = Math.min(1f, (visualHeight / 3f) / height);
        if (heightScale < 1f) {
            scale *= heightScale;
            width *= heightScale;
            height *= heightScale;
        }
        float x;
        float y;
        if (placed) {
            x = rule.stampX().floatValue() * visualWidth;
            y = visualHeight - rule.stampY().floatValue() * visualHeight - height;
        } else {
            float margin = p.getStampMarginMm() * POINTS_PER_MM;
            x = p.getStampPosition().endsWith("LEFT") ? margin : visualWidth - margin - width;
            y = p.getStampPosition().startsWith("TOP") ? visualHeight - margin - height : margin;
        }
        // a large margin (or a position near the edge) must not push the stamp off the page
        x = Math.max(0f, Math.min(x, visualWidth - width));
        y = Math.max(0f, Math.min(y, visualHeight - height));
        return new StampBox(x, y, width, height, scale, titleSize, subSize, padding, safe);
    }

    /**
     * Moves a stamp clear of the stamps already on the page. It slides the stamp away from the edge it sits on (stacking it next
     * to the existing one), then along the row, then tries the other corners; if no position is free it keeps the least
     * overlapping one.
     */
    private static StampBox avoidStampOverlap(StampBox box, List<Placement> obstacles, float pageWidth, float pageHeight) {
        if (obstacles.isEmpty() || !collides(box, obstacles)) {
            return box;
        }
        boolean top = box.y() + box.height() / 2f >= pageHeight / 2f;
        boolean left = box.x() + box.width() / 2f < pageWidth / 2f;
        float stepY = box.height() + MARK_GAP;
        float stepX = box.width() + MARK_GAP;
        float margin = 4f * POINTS_PER_MM;
        List<StampBox> candidates = new ArrayList<>();
        for (int k = 1; k <= 12; k++) {
            candidates.add(box.at(box.x(), top ? box.y() - k * stepY : box.y() + k * stepY));
        }
        for (int k = 1; k <= 6; k++) {
            candidates.add(box.at(left ? box.x() + k * stepX : box.x() - k * stepX, box.y()));
        }
        float right = pageWidth - margin - box.width();
        float upper = pageHeight - margin - box.height();
        candidates.add(box.at(margin, upper));
        candidates.add(box.at(right, upper));
        candidates.add(box.at(margin, margin));
        candidates.add(box.at(right, margin));
        StampBox best = box;
        float bestOverlap = Float.MAX_VALUE;
        for (StampBox candidate : candidates) {
            if (!candidate.inside(pageWidth, pageHeight)) {
                continue;
            }
            if (!collides(candidate, obstacles)) {
                return candidate;
            }
            float overlap = overlapArea(candidate, obstacles);
            if (overlap < bestOverlap) {
                bestOverlap = overlap;
                best = candidate;
            }
        }
        return best;
    }

    private static boolean collides(StampBox box, List<Placement> obstacles) {
        Placement candidate = new Placement(0, "STAMP", box.x(), box.y(), box.width(), box.height(), 0, 0, 0f, false);
        return obstacles.stream().anyMatch(o -> candidate.overlaps(o, MARK_GAP));
    }

    private static float overlapArea(StampBox box, List<Placement> obstacles) {
        float total = 0;
        for (Placement o : obstacles) {
            float w = Math.min(box.x() + box.width(), o.x() + o.width()) - Math.max(box.x(), o.x());
            float h = Math.min(box.y() + box.height(), o.y() + o.height()) - Math.max(box.y(), o.y());
            if (w > 0 && h > 0) {
                total += w * h;
            }
        }
        return total;
    }

    private void drawStamp(PDPageContentStream content, PDFont font, StampBox box, ControlledCopyPolicySetting p) throws IOException {
        List<String> safe = box.lines();
        float x = box.x();
        float y = box.y();
        float width = box.width();
        float height = box.height();
        float scale = box.scale();
        Color color = Color.decode(p.getStampColor());

        content.saveGraphicsState();
        setOpacity(content, p.getStampOpacityPercent() / 100f);
        content.setStrokingColor(color);
        content.setNonStrokingColor(color);
        content.setLineWidth(1.6f * scale);
        content.addRect(x, y, width, height);
        content.stroke();
        float cursorY = y + height - box.padding() * scale;
        for (int i = 0; i < safe.size(); i++) {
            float size = (i == 0 ? box.titleSize() : box.subSize()) * scale;
            cursorY -= size * 1.0f;
            float textWidth = textWidth(font, safe.get(i), size);
            content.beginText();
            content.setFont(font, size);
            content.newLineAtOffset(x + (width - textWidth) / 2f, cursorY);
            content.showText(safe.get(i));
            content.endText();
            cursorY -= size * 0.25f;
        }
        content.restoreGraphicsState();
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Watermark
    // ------------------------------------------------------------------------------------------------------------------

    /**
     * @param shiftFraction moves the watermark up (+) or down (-) by this share of the page height, from where it would be
     * @param sizeFactor    multiplies its size (used when it has to squeeze in beside another watermark)
     */
    private WatermarkBox layoutWatermark(PDFont font, List<String> lines, ControlledCopyPolicySetting p, float visualWidth, float visualHeight,
                                         MarkingPlacementRule rule, float shiftFraction, float sizeFactor) throws IOException {
        List<String> safe = lines.stream().map(line -> printable(font, line)).toList();
        float angleDegrees = rule != null && rule.watermarkAngleDegrees() != null ? rule.watermarkAngleDegrees() : p.getWatermarkAngleDegrees();
        double angle = Math.toRadians(angleDegrees);
        float diagonal = (float) Math.sqrt(visualWidth * visualWidth + visualHeight * visualHeight);
        float titleSize = Math.min(visualWidth, visualHeight) / 7f;
        float subSize = titleSize * 0.2f;
        float widest = 0;
        for (int i = 0; i < safe.size(); i++) {
            widest = Math.max(widest, textWidth(font, safe.get(i), i == 0 ? titleSize : subSize));
        }
        // Keep the rotated text inside the page: its horizontal and vertical extent at this angle must fit with a margin.
        float cos = (float) Math.abs(Math.cos(angle));
        float sin = (float) Math.abs(Math.sin(angle));
        float maxWidth = diagonal * 0.7f;
        if (cos > 0.01f) {
            maxWidth = Math.min(maxWidth, 0.85f * visualWidth / cos);
        }
        if (sin > 0.01f) {
            maxWidth = Math.min(maxWidth, 0.85f * visualHeight / sin);
        }
        float scale = Math.min(1f, maxWidth / Math.max(widest, 1f)) * sizeFactor;
        if (rule != null && rule.watermarkScalePercent() != null) {
            scale *= rule.watermarkScalePercent() / 100f;
        }
        float blockHeight = 0;
        for (int i = 0; i < safe.size(); i++) {
            blockHeight += (i == 0 ? titleSize : subSize) * 1.3f;
        }
        float width = widest * scale;
        float height = blockHeight * scale;
        // a size chosen by the administrator may still not make the rotated block larger than the page
        float boundingWidth = width * cos + height * sin;
        float boundingHeight = width * sin + height * cos;
        float fit = Math.min(1f, Math.min(visualWidth * 0.98f / boundingWidth, visualHeight * 0.98f / boundingHeight));
        scale *= fit;
        width *= fit;
        height *= fit;
        boundingWidth *= fit;
        boundingHeight *= fit;
        float centreX = rule != null && rule.hasWatermarkPosition() ? rule.watermarkX().floatValue() * visualWidth : visualWidth / 2f;
        float centreY = rule != null && rule.hasWatermarkPosition()
                ? visualHeight - rule.watermarkY().floatValue() * visualHeight : visualHeight / 2f;
        centreY += shiftFraction * visualHeight;
        centreX = Math.max(boundingWidth / 2f, Math.min(centreX, visualWidth - boundingWidth / 2f));
        centreY = Math.max(boundingHeight / 2f, Math.min(centreY, visualHeight - boundingHeight / 2f));
        return new WatermarkBox(centreX, centreY, width, height, titleSize * scale, subSize * scale, angleDegrees, safe);
    }

    /** Shifts / shrinks a watermark until it no longer overlaps a watermark the copy already carries. */
    private WatermarkBox avoidWatermarkOverlap(PDFont font, List<String> lines, ControlledCopyPolicySetting p, float visualWidth,
                                               float visualHeight, MarkingPlacementRule rule, WatermarkBox wanted,
                                               List<Placement> obstacles) throws IOException {
        if (obstacles.isEmpty() || !collides(wanted, visualWidth, visualHeight, obstacles)) {
            return wanted;
        }
        float[] sizes = {1f, 0.85f, 0.7f, 0.55f};
        float[] shifts = {0.2f, -0.2f, 0.32f, -0.32f, 0.42f, -0.42f};
        for (float size : sizes) {
            for (float shift : shifts) {
                WatermarkBox candidate = layoutWatermark(font, lines, p, visualWidth, visualHeight, rule, shift, size);
                if (!collides(candidate, visualWidth, visualHeight, obstacles)) {
                    return candidate;
                }
            }
        }
        return wanted;
    }

    private static boolean collides(WatermarkBox box, float visualWidth, float visualHeight, List<Placement> obstacles) {
        Placement candidate = box.asPlacement(0, visualWidth, visualHeight, false);
        return obstacles.stream().anyMatch(o -> candidate.overlaps(o, MARK_GAP));
    }

    private void drawWatermark(PDPageContentStream content, PDFont font, WatermarkBox box, ControlledCopyPolicySetting p) throws IOException {
        List<String> safe = box.lines();
        Color color = Color.decode(p.getWatermarkColor());

        content.saveGraphicsState();
        setOpacity(content, p.getWatermarkOpacityPercent() / 100f);
        content.setNonStrokingColor(color);
        // Move the origin to the watermark's centre, then rotate about it (Matrix.getRotateInstance rotates about the ORIGIN).
        content.transform(Matrix.getTranslateInstance(box.centreX(), box.centreY()));
        content.transform(Matrix.getRotateInstance(Math.toRadians(box.angleDegrees()), 0, 0));
        float totalHeight = 0;
        for (int i = 0; i < safe.size(); i++) {
            totalHeight += (i == 0 ? box.titleSize() : box.subSize()) * 1.3f;
        }
        float cursorY = totalHeight / 2f;
        for (int i = 0; i < safe.size(); i++) {
            float size = i == 0 ? box.titleSize() : box.subSize();
            cursorY -= size * 1.05f;
            float textWidth = textWidth(font, safe.get(i), size);
            content.beginText();
            content.setFont(font, size);
            content.newLineAtOffset(-textWidth / 2f, cursorY);
            content.showText(safe.get(i));
            content.endText();
            cursorY -= size * 0.25f;
        }
        content.restoreGraphicsState();
    }

    // ------------------------------------------------------------------------------------------------------------------
    // Geometry and text helpers
    // ------------------------------------------------------------------------------------------------------------------

    /** Overlap of two rectangles, each given by centre, half extents and rotation (separating-axis test). */
    private static boolean orientedOverlap(float ax, float ay, float ahw, float ahh, double aAngle,
                                           float bx, float by, float bhw, float bhh, double bAngle) {
        double[][] axes = {
                {Math.cos(aAngle), Math.sin(aAngle)}, {-Math.sin(aAngle), Math.cos(aAngle)},
                {Math.cos(bAngle), Math.sin(bAngle)}, {-Math.sin(bAngle), Math.cos(bAngle)}
        };
        for (double[] axis : axes) {
            double aRadius = ahw * Math.abs(dot(axis, Math.cos(aAngle), Math.sin(aAngle)))
                    + ahh * Math.abs(dot(axis, -Math.sin(aAngle), Math.cos(aAngle)));
            double bRadius = bhw * Math.abs(dot(axis, Math.cos(bAngle), Math.sin(bAngle)))
                    + bhh * Math.abs(dot(axis, -Math.sin(bAngle), Math.cos(bAngle)));
            double distance = Math.abs((bx - ax) * axis[0] + (by - ay) * axis[1]);
            if (distance > aRadius + bRadius) {
                return false;
            }
        }
        return true;
    }

    private static double dot(double[] axis, double x, double y) {
        return axis[0] * x + axis[1] * y;
    }

    private static void setOpacity(PDPageContentStream content, float opacity) throws IOException {
        PDExtendedGraphicsState state = new PDExtendedGraphicsState();
        state.setStrokingAlphaConstant(opacity);
        state.setNonStrokingAlphaConstant(opacity);
        content.setGraphicsStateParameters(state);
    }

    private static float textWidth(PDFont font, String text, float size) throws IOException {
        return font.getStringWidth(text) / 1000f * size;
    }

    /** Replaces characters the font has no glyph for, so an unusual name can never break issuing a copy. */
    private static String printable(PDFont font, String text) {
        StringBuilder out = new StringBuilder();
        text.codePoints().forEach(codePoint -> {
            String character = new String(Character.toChars(codePoint));
            try {
                font.encode(character);
                out.append(character);
            } catch (IOException | IllegalArgumentException ex) {
                out.append('?');
            }
        });
        return out.toString();
    }
}
