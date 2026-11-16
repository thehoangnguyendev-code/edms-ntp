package com.eqms.service.report;

import org.apache.pdfbox.pdmodel.PDPageContentStream;
import java.util.*;

/**
 * The frame of a PDF page (REPORT-APPEARANCE-2026-11-14): the header and footer bands with three places each, the block of information above the table, and the
 * page of approval and notes after it. Every height here is worked out before the table is drawn and the table starts below it, so the logo and the texts of
 * the bands can never lie over the data. The logo's place is worked out here once, for the page and for the preview that the editor draws its frame over.
 */
final class ReportPageFrame {
    private ReportPageFrame() {}
    static final float MARGIN = 30, TOP_PAD = 8, BOTTOM_PAD = 8, LINE = 1.25f, MAX_LOGO_HEIGHT = 70, INFO_ROW = 13;
    static final List<String> PLACES = List.of("LEFT", "CENTER", "RIGHT");
    /** The approval block is a table (REPORT-APPROVAL-TABLE-2026-11-14): a heading, a row of column names, and a row for each role. The first column holds the roles. */
    static final float APPROVAL_HEADING = 26, APPROVAL_HEAD_ROW = 22, APPROVAL_ROW = 30;
    /** The column of the roles takes this share of the table; the shown columns share the rest, the first four of them in the proportions of the standard table. */
    static final float APPROVAL_ROLE_SHARE = 0.16f;
    private static final float[] APPROVAL_WEIGHTS = { 0.20f, 0.26f, 0.22f, 0.16f };

    /** The share of the table of each column: the roles first, then the shown columns. */
    static float[] approvalWidths(ReportLayout.Frame frame) {
        var shown = frame.shownApprovalColumns();
        float[] widths = new float[shown.size() + 1];
        widths[0] = APPROVAL_ROLE_SHARE;
        float total = 0;
        for (int i = 0; i < shown.size(); i++) { widths[i + 1] = i < APPROVAL_WEIGHTS.length ? APPROVAL_WEIGHTS[i] : 0.2f; total += widths[i + 1]; }
        for (int i = 1; i < widths.length; i++) widths[i] = widths[i] / total * (1 - APPROVAL_ROLE_SHARE);
        return widths;
    }

    static float slotWidth(float pageWidth) { return (pageWidth - 2 * MARGIN) / 3; }

    /** Where the logo is drawn, in points from the bottom left of the page: {x, y, width, height}; null when the layout has no logo. */
    static float[] logoRect(ReportLayout layout, float pageWidth, float pageHeight) {
        var logo = layout.logo();
        if (logo == null || !logo.enabled() || logo.data() == null || logo.data().isBlank()) return null;
        var image = ReportImage.decode(logo.data());
        float slot = slotWidth(pageWidth);
        float width = Math.min((float) (logo.width() * pageWidth / 100), slot);
        float height = width * image.getHeight() / image.getWidth();
        if (height > MAX_LOGO_HEIGHT) { width *= MAX_LOGO_HEIGHT / height; height = MAX_LOGO_HEIGHT; }
        return new float[] { slotX(logo.effectiveSlot(), width, pageWidth), pageHeight - TOP_PAD - height, width, height };
    }

    private static float slotX(String place, float contentWidth, float pageWidth) {
        float slot = slotWidth(pageWidth);
        return switch (place) {
            case "LEFT" -> MARGIN;
            case "CENTER" -> MARGIN + slot + (slot - contentWidth) / 2;
            default -> MARGIN + 3 * slot - contentWidth;
        };
    }

    private static List<String> lines(String text) {
        return text.isBlank() ? List.of() : Arrays.asList(text.split("\\R", -1));
    }

    /** The height of the header band: the tallest of its three places (the logo above the text where both are in one place), and the room around it. */
    static float headerHeight(ReportLayout layout, float pageWidth, float pageHeight, boolean legacyLogo) {
        var frame = layout.effectiveFrame();
        float logoHeight = 0; String logoPlace = "";
        float[] rect = legacyLogo ? null : logoRect(layout, pageWidth, pageHeight);
        if (rect != null) { logoHeight = rect[3]; logoPlace = layout.logo().effectiveSlot(); }
        float tallest = 0;
        for (String place : PLACES) {
            var slot = frame.header(place);
            float height = lines(slot.effectiveText()).size() * slot.effectiveSize(true) * LINE;
            if (place.equals(logoPlace)) height += logoHeight + (height > 0 ? 3 : 0);
            tallest = Math.max(tallest, height);
        }
        return Math.max(tallest, 12) + TOP_PAD + BOTTOM_PAD;
    }

    /** The lines of one place of the footer; the page number is the last line of the right one. */
    private static List<String> footerLines(ReportLayout layout, String place, Map<String, String> context, int pageNumber, int pages, boolean pageNumberInFooter) {
        var list = new ArrayList<>(lines(layout.resolve(layout.effectiveFrame().footer(place).effectiveText(), context)));
        if (pageNumberInFooter && "RIGHT".equals(place)) list.add(pageNumber + " / " + pages);
        return list;
    }

    /** The height of the footer band (without the lines of GMP status and signature that go above it). */
    static float footerHeight(ReportLayout layout, boolean wordFooter) {
        if (wordFooter) return 0;
        var frame = layout.effectiveFrame();
        float tallest = 0;
        for (String place : PLACES) {
            int count = lines(frame.footer(place).effectiveText()).size() + ("RIGHT".equals(place) && layout.pageNumbers() ? 1 : 0);
            tallest = Math.max(tallest, count * frame.footer(place).effectiveSize(false) * LINE);
        }
        return Math.max(tallest, 9);
    }

    /** The logo is added to a document once and drawn on every page from that one copy: adding it on each page made a report of 155 pages 8 MB. */
    private static final java.util.Map<org.apache.pdfbox.pdmodel.PDDocument, org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject> LOGOS = java.util.Collections.synchronizedMap(new java.util.WeakHashMap<>());

    static org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject logoImage(org.apache.pdfbox.pdmodel.PDDocument pdf, ReportLayout layout) throws java.io.IOException {
        var cached = LOGOS.get(pdf);
        if (cached != null) return cached;
        var created = org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory.createFromImage(pdf, ReportImage.decode(layout.logo().data()));
        LOGOS.put(pdf, created);
        return created;
    }

    static void drawHeader(ReportStyledText text, PDPageContentStream stream, ReportLayout layout, Map<String, String> context,
            float pageWidth, float pageHeight, boolean firstPage, boolean legacyLogo) throws Exception {
        var frame = layout.effectiveFrame();
        float[] rect = legacyLogo ? null : logoRect(layout, pageWidth, pageHeight);
        boolean showLogo = rect != null && (firstPage || "ALL".equals(layout.logo().pages()));
        String logoPlace = rect == null ? "" : layout.logo().effectiveSlot();
        boolean any = showLogo;
        for (String place : PLACES) {
            var slot = frame.header(place);
            float cursor = pageHeight - TOP_PAD;
            if (place.equals(logoPlace)) {
                if (showLogo) stream.drawImage(logoImage(text.pdf(), layout), rect[0], rect[1], rect[2], rect[3]);
                cursor -= rect[3] + 3;
            }
            for (String line : lines(layout.resolve(slot.effectiveText(), context))) {
                any = true;
                cursor = drawLine(text, stream, slot.style(), line, place, cursor, slot.effectiveSize(true), pageWidth);
            }
        }
        if (any) rule(stream, pageWidth, pageHeight - headerHeight(layout, pageWidth, pageHeight, legacyLogo) + BOTTOM_PAD / 2);
    }

    static void drawFooter(ReportStyledText text, PDPageContentStream stream, ReportLayout layout, Map<String, String> context, float pageWidth,
            int pageNumber, int pages, boolean pageNumberInFooter) throws Exception {
        var frame = layout.effectiveFrame();
        float top = BOTTOM_PAD + footerHeight(layout, false);
        boolean any = false;
        for (String place : PLACES) {
            float cursor = top;
            for (String line : footerLines(layout, place, context, pageNumber, pages, pageNumberInFooter)) {
                any = true;
                cursor = drawLine(text, stream, frame.footer(place).style(), line, place, cursor, frame.footer(place).effectiveSize(false), pageWidth);
            }
        }
        if (any) rule(stream, pageWidth, top + 2);
    }

    /** Draws one line in a place, in the style of the place, shrunk to fit the place, and gives the y of the next line. */
    private static float drawLine(ReportStyledText text, PDPageContentStream stream, ReportTextStyle style, String line, String place, float cursor, int size, float pageWidth) throws Exception {
        var fit = text.fit(style, line, size, slotWidth(pageWidth) - 6);
        text.draw(stream, style, fit, slotX(place, fit.width(), pageWidth), cursor - size, java.awt.Color.BLACK);
        return cursor - size * LINE;
    }

    private static void rule(PDPageContentStream stream, float pageWidth, float y) throws Exception {
        stream.saveGraphicsState(); stream.setStrokingColor(java.awt.Color.LIGHT_GRAY); stream.setLineWidth(0.5f);
        stream.moveTo(MARGIN, y); stream.lineTo(pageWidth - MARGIN, y); stream.stroke(); stream.restoreGraphicsState();
    }

    /** The room the block of information takes above the table of the first page; 0 when there is none. */
    /** The height of a row of information: 13 points, more when the text of the information is set larger. */
    static float infoRow(ReportLayout layout) {
        var frame = layout.effectiveFrame();
        int label = frame.infoLabelStyle() == null ? 8 : frame.infoLabelStyle().effectiveSize(8), value = frame.infoValueStyle() == null ? 8 : frame.infoValueStyle().effectiveSize(8);
        return Math.max(INFO_ROW, Math.max(label, value) * 1.5f);
    }

    static float infoHeight(ReportLayout layout) {
        var items = layout.effectiveFrame().effectiveInfo();
        if (items.isEmpty()) return 0;
        int columns = layout.effectiveFrame().effectiveInfoColumns();
        return (float) Math.ceil(items.size() / (double) columns) * infoRow(layout) + 12;
    }

    /** The block of information: label and value pairs in one or two columns, from the top of the table's room down. */
    static void drawInfo(ReportStyledText text, PDPageContentStream stream, ReportLayout layout, Map<String, String> context, float pageWidth, float top) throws Exception {
        var frame = layout.effectiveFrame();
        var items = frame.effectiveInfo();
        if (items.isEmpty()) return;
        int columns = frame.effectiveInfoColumns();
        int rows = (int) Math.ceil(items.size() / (double) columns);
        float row = infoRow(layout);
        float columnWidth = (pageWidth - 2 * MARGIN) / columns, labelWidth = Math.min(120, columnWidth * 0.4f);
        var labelStyle = frame.infoLabelStyle();
        var valueStyle = frame.infoValueStyle();
        float labelSize = labelStyle == null ? 8 : labelStyle.effectiveSize(8), valueSize = valueStyle == null ? 8 : valueStyle.effectiveSize(8);
        for (int i = 0; i < items.size(); i++) {
            // The items run down the first column, then down the second: a long list reads as two lists, not as pairs.
            int column = i / rows, r = i % rows;
            float x = MARGIN + column * columnWidth, y = top - 9 - r * row;
            text.drawIn(stream, labelStyle, layout.resolve(items.get(i).label(), context) + ":", x, y, labelSize, labelWidth - 4, java.awt.Color.DARK_GRAY);
            text.drawIn(stream, valueStyle, layout.resolve(items.get(i).value(), context), x + labelWidth, y, valueSize, columnWidth - labelWidth - 8, java.awt.Color.BLACK);
        }
        rule(stream, pageWidth, top - rows * row - 6);
    }

    /** A part of a page that a person can point at in the editor: its kind and its place in points from the bottom left of the page. */
    record Zone(String kind, float x, float y, float width, float height) {}

    /**
     * Where the parts of a page are, for the editor to draw its click targets over the preview (REPORT-APPEARANCE-2026-11-14): the three places of the header and of
     * the footer on every page, the information above the table on the first page of the table, and the approval block and the notes box on the page after it.
     * The same numbers the page is drawn with, so a target is always over what it names.
     */
    static List<Zone> zones(ReportLayout layout, float pageWidth, float pageHeight, boolean tablePage, boolean closingPage) {
        var zones = new ArrayList<Zone>();
        var frame = layout.effectiveFrame();
        float slot = slotWidth(pageWidth), band = headerHeight(layout, pageWidth, pageHeight, false), foot = BOTTOM_PAD + footerHeight(layout, false);
        for (int i = 0; i < PLACES.size(); i++) {
            String place = PLACES.get(i);
            float x = MARGIN + i * slot;
            zones.add(new Zone("HEADER_" + place, x, pageHeight - band, slot, band));
            zones.add(new Zone("FOOTER_" + place, x, 0, slot, foot + 4));
        }
        float top = pageHeight - (band + 10);
        if (tablePage && infoHeight(layout) > 0) zones.add(new Zone("INFO", MARGIN, top - infoHeight(layout), pageWidth - 2 * MARGIN, infoHeight(layout)));
        if (closingPage) {
            float used = 0;
            if (frame.approval()) {
                float approval = APPROVAL_HEADING + APPROVAL_HEAD_ROW + frame.effectiveApprovalRoles().size() * APPROVAL_ROW;
                zones.add(new Zone("APPROVAL", MARGIN, top - approval, pageWidth - 2 * MARGIN, approval));
                used = approval + 10;
            }
            if (frame.notes()) zones.add(new Zone("NOTES", MARGIN, top - used - frame.effectiveNotesHeight() - 14, pageWidth - 2 * MARGIN, frame.effectiveNotesHeight() + 14));
        }
        return zones;
    }

    static boolean hasClosingPage(ReportLayout layout) {
        var frame = layout.effectiveFrame();
        return frame.approval() || frame.notes();
    }

    /** The page after the table: lines for the people who prepare, review and approve (name, signature and date) and the box for notes. */
    static void drawClosingPage(ReportStyledText text, PDPageContentStream stream, ReportLayout layout, float pageWidth, float pageHeight, float top) throws Exception {
        var frame = layout.effectiveFrame();
        float y = pageHeight - top;
        stream.setNonStrokingColor(java.awt.Color.BLACK);
        if (frame.approval()) {
            var style = frame.approvalStyle();
            float size = style == null ? 9 : style.effectiveSize(9);
            text.drawIn(stream, style, "Approval", MARGIN, y, size + 2, 200, java.awt.Color.BLACK);
            var roles = frame.effectiveApprovalRoles();
            float width = pageWidth - 2 * MARGIN, tableTop = y - 12;
            var columns = frame.shownApprovalColumns();
            float[] widths = approvalWidths(frame);
            float[] edge = new float[widths.length + 1];
            for (int i = 0; i < widths.length; i++) edge[i + 1] = edge[i] + widths[i] * width;
            float bottom = tableTop - APPROVAL_HEAD_ROW - roles.size() * APPROVAL_ROW;
            // the grid: a line over each row and a line down each column
            stream.setStrokingColor(java.awt.Color.BLACK); stream.setLineWidth(0.5f);
            for (int row = 0; row <= roles.size() + 1; row++) {
                float line = row == 0 ? tableTop : row == 1 ? tableTop - APPROVAL_HEAD_ROW : tableTop - APPROVAL_HEAD_ROW - (row - 1) * APPROVAL_ROW;
                stream.moveTo(MARGIN, line); stream.lineTo(MARGIN + width, line); stream.stroke();
            }
            for (float x : edge) { stream.moveTo(MARGIN + x, tableTop); stream.lineTo(MARGIN + x, bottom); stream.stroke(); }
            // the names of the columns, then the roles; a text is shrunk to the width of its cell
            float headBase = tableTop - APPROVAL_HEAD_ROW / 2 - size * 0.35f;
            for (int i = 0; i < columns.size(); i++) text.drawIn(stream, (style == null ? new ReportTextStyle(null, null, null, null, null, null, null, null) : style).withAlign(columns.get(i).effectiveAlign()), columns.get(i).effectiveLabel(), MARGIN + edge[i + 1] + 4, headBase, size, edge[i + 2] - edge[i + 1] - 8, java.awt.Color.BLACK);
            for (int i = 0; i < roles.size(); i++) {
                float rowTop = tableTop - APPROVAL_HEAD_ROW - i * APPROVAL_ROW;
                text.drawIn(stream, style, roles.get(i), MARGIN + 4, rowTop - APPROVAL_ROW / 2 - size * 0.35f, size, edge[1] - 8, java.awt.Color.BLACK);
            }
            y = bottom - 24;
        }
        if (frame.notes()) {
            var style = frame.notesStyle();
            text.drawIn(stream, style, "Notes / Comments", MARGIN, y, style == null ? 9 : style.effectiveSize(9), 200, java.awt.Color.BLACK);
            float height = frame.effectiveNotesHeight();
            stream.setStrokingColor(java.awt.Color.GRAY); stream.setLineWidth(0.75f);
            stream.addRect(MARGIN, y - 6 - height, pageWidth - 2 * MARGIN, height); stream.stroke();
        }
    }
}
