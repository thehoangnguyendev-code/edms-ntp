package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Builds the notice handed to a recipient when a Controlled Copy is withdrawn (recalled, expired, superseded, lost...):
 * which copy, who held it, why and when it was withdrawn, and a return/acknowledgement block. It is generated on the server
 * from the copy's own record and the recipient details captured at distribution, so its content cannot be typed in.
 */
@Service
public class ControlledCopyWithdrawalNoticeService {

    private static final String FONT_RESOURCE = "/fonts/NotoSans-Bold.ttf";
    private static final float PAGE_MARGIN = 50f;
    private static final float BODY_SIZE = 10.5f;

    /** Human-readable reason for the withdrawal, from the copy's obsolete reason. */
    public static String reasonLabel(String obsoleteReason) {
        String reason = obsoleteReason == null ? "" : obsoleteReason.trim().toUpperCase(Locale.ROOT);
        return switch (reason) {
            case "RECALLED" -> "Recalled by Document Control";
            case "EXPIRED" -> "Expiry date passed";
            case "NEW_REVISION_PUBLISHED" -> "Replaced by a newer revision";
            case "REVISION_OBSOLETED" -> "The revision was made obsolete";
            case "DOCUMENT_OBSOLETED" -> "The document was made obsolete";
            case "LOST" -> "Reported lost";
            case "DAMAGED" -> "Reported damaged";
            case "DESTROYED" -> "Destroyed at end of life";
            default -> "Withdrawn";
        };
    }

    public byte[] build(ControlledCopyRecord copy, JsonNode recipient, UserAccount generatedBy) {
        boolean recalled = "RECALLED".equalsIgnoreCase(copy.getObsoleteReason());
        String title = recalled ? "CONTROLLED COPY RECALL NOTICE" : "CONTROLLED COPY WITHDRAWAL NOTICE";

        List<String[]> facts = new ArrayList<>();
        facts.add(new String[] {"Controlled copy", value(copy.getControlledCopyNumber())});
        facts.add(new String[] {"Document", value(copy.getDocumentNumber()) + " - " + value(copy.getDocumentTitle())});
        facts.add(new String[] {"Revision", value(copy.getRevisionNumber())});
        facts.add(new String[] {"Copy", copy.getCopyNumber() + " of " + Math.max(copy.getTotalCopies(), 1)});
        facts.add(new String[] {"Held by", value(recipient == null ? null : recipient.path("name").asText(null))});
        facts.add(new String[] {"E-mail", value(recipient == null ? null : recipient.path("email").asText(null))});
        String jobTitle = recipient == null ? "" : recipient.path("jobTitle").asText("");
        String department = recipient == null ? "" : recipient.path("department").asText("");
        if (StringUtils.hasText(jobTitle) || StringUtils.hasText(department)) {
            facts.add(new String[] {"Job title / department", (StringUtils.hasText(jobTitle) ? jobTitle : "-") + " / " + (StringUtils.hasText(department) ? department : "-")});
        }
        facts.add(new String[] {"Location", value(copy.getLocation())});
        facts.add(new String[] {"Distributed", copy.getDistributedAt() == null ? "-"
                : DateTimeFormatUtils.formatDateTime(copy.getDistributedAt())
                + (copy.getDistributedBy() == null ? "" : " by " + value(copy.getDistributedBy().getFullName()))});
        facts.add(new String[] {"Reason for withdrawal", reasonLabel(copy.getObsoleteReason())});
        if (StringUtils.hasText(copy.getRecallReason())) {
            facts.add(new String[] {"Details", copy.getRecallReason().trim()});
        }
        java.time.Instant withdrawnAt = copy.getRecalledAt() != null ? copy.getRecalledAt() : copy.getObsoletedAt();
        facts.add(new String[] {"Withdrawn on", withdrawnAt == null ? "-" : DateTimeFormatUtils.formatDateTime(withdrawnAt)
                + (recalled && copy.getRecalledBy() != null ? " by " + value(copy.getRecalledBy().getFullName()) : "")});

        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDFont font;
            try (InputStream fontStream = getClass().getResourceAsStream(FONT_RESOURCE)) {
                if (fontStream == null) {
                    throw new IllegalStateException("The notice font is not available");
                }
                font = PDType0Font.load(document, fontStream);
            }
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            float width = page.getMediaBox().getWidth();
            float contentWidth = width - 2 * PAGE_MARGIN;
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                float y = page.getMediaBox().getHeight() - PAGE_MARGIN;
                // title band
                content.setNonStrokingColor(new Color(0xC0, 0x00, 0x00));
                content.addRect(PAGE_MARGIN, y - 34, contentWidth, 34);
                content.fill();
                content.setNonStrokingColor(Color.WHITE);
                text(content, font, 16, PAGE_MARGIN + 12, y - 23, title);
                y -= 56;

                content.setNonStrokingColor(Color.BLACK);
                text(content, font, BODY_SIZE, PAGE_MARGIN, y, printable(font,
                        "Generated " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now())
                                + (generatedBy == null ? "" : " by " + value(generatedBy.getFullName()))));
                y -= 26;

                float labelWidth = 150f;
                for (String[] fact : facts) {
                    List<String> lines = wrap(font, printable(font, fact[1]), BODY_SIZE, contentWidth - labelWidth);
                    content.setNonStrokingColor(new Color(0x55, 0x55, 0x55));
                    text(content, font, BODY_SIZE, PAGE_MARGIN, y, printable(font, fact[0]));
                    content.setNonStrokingColor(Color.BLACK);
                    for (String line : lines) {
                        text(content, font, BODY_SIZE, PAGE_MARGIN + labelWidth, y, line);
                        y -= 15;
                    }
                    y -= 3;
                }

                y -= 8;
                content.setStrokingColor(new Color(0xBB, 0xBB, 0xBB));
                content.moveTo(PAGE_MARGIN, y);
                content.lineTo(PAGE_MARGIN + contentWidth, y);
                content.stroke();
                y -= 24;
                for (String line : wrap(font,
                        "Stop using this copy now. Do not copy, photograph or pass it on. Return it to Document Control; the current "
                                + "version of the document is available in EQMS. This notice is not the controlled document.",
                        BODY_SIZE, contentWidth)) {
                    text(content, font, BODY_SIZE, PAGE_MARGIN, y, line);
                    y -= 15;
                }

                y -= 26;
                y = signatureBlock(content, font, y, contentWidth, "Returned by (recipient)");
                y -= 14;
                signatureBlock(content, font, y, contentWidth, "Received by (Document Control)");
            }
            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to generate the controlled copy notice", ex);
        }
    }

    private static float signatureBlock(PDPageContentStream content, PDFont font, float y, float width, String label) throws IOException {
        content.setNonStrokingColor(Color.BLACK);
        text(content, font, BODY_SIZE, PAGE_MARGIN, y, label);
        float lineY = y - 30;
        content.setStrokingColor(Color.BLACK);
        float third = (width - 40) / 3f;
        String[] captions = {"Name", "Signature", "Date"};
        for (int i = 0; i < 3; i++) {
            float x = PAGE_MARGIN + i * (third + 20);
            content.moveTo(x, lineY);
            content.lineTo(x + third, lineY);
            content.stroke();
            content.setNonStrokingColor(new Color(0x77, 0x77, 0x77));
            text(content, font, 8.5f, x, lineY - 11, captions[i]);
            content.setNonStrokingColor(Color.BLACK);
        }
        return lineY - 24;
    }

    private static void text(PDPageContentStream content, PDFont font, float size, float x, float y, String value) throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(value);
        content.endText();
    }

    private static List<String> wrap(PDFont font, String value, float size, float maxWidth) throws IOException {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String word : value.split("\\s+")) {
            String candidate = current.length() == 0 ? word : current + " " + word;
            if (font.getStringWidth(candidate) / 1000f * size > maxWidth && current.length() > 0) {
                lines.add(current.toString());
                current = new StringBuilder(word);
            } else {
                current = new StringBuilder(candidate);
            }
        }
        if (current.length() > 0) {
            lines.add(current.toString());
        }
        return lines.isEmpty() ? List.of("-") : lines;
    }

    private static String value(String text) {
        return StringUtils.hasText(text) ? text.trim() : "-";
    }

    /** Replaces characters the font has no glyph for, so an unusual name can never break the notice. */
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
