package com.eqms.util;

import com.eqms.entity.EmailDesign;

import java.time.Year;
import java.util.List;
import java.util.Locale;

/**
 * Puts the content of any email into the one frame the whole system uses: a coloured header with the logo, a white card, an optional
 * action button and a quiet footer. The frame is table based and inline styled so that mail apps render it; a dark scheme and a narrow
 * screen are handled with media queries for the apps that read them.
 */
public final class EmailFrameRenderer {

    /** Fonts that mail apps have, so the look does not depend on what the reader has installed. */
    public static final List<String> SAFE_FONTS = List.of(
            "Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS", "Georgia", "Times New Roman", "Segoe UI");

    /**
     * Put into the content of a mail whose wording is Vietnamese. The frame is added when the mail is sent, possibly much later and from stored content, so the
     * language travels with the content; a mail without it has the English frame.
     */
    public static final String VIETNAMESE_MARK = "<!--lang:vi-->";

    static final String DEFAULT_BODY = "#FFFFFF";
    static final String DEFAULT_FOOTER = "#F8FAFC";

    private EmailFrameRenderer() {
    }

    /** True when the text already is a whole HTML document (a sender that built its own page), which must not be framed twice. */
    public static boolean isFullDocument(String html) {
        if (html == null) return false;
        String head = html.stripLeading().toLowerCase(Locale.ROOT);
        return head.startsWith("<!doctype") || head.startsWith("<html");
    }

    /**
     * Every mail opens with the name of the person who receives it. A template that already greets its reader (Dear, Hello, Kính gửi...) is left as it is,
     * so the wording is never greeted twice. The name is escaped like any other text of the mail.
     */
    public static String withGreeting(String contentHtml, String recipientName, boolean vietnamese) {
        if (contentHtml == null || contentHtml.isBlank()) return contentHtml;
        String plain = contentHtml.replaceAll("(?s)<!--.*?-->", " ").replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ").stripLeading().toLowerCase(Locale.ROOT);
        if (plain.startsWith("kính gửi") || plain.startsWith("dear") || plain.startsWith("hello")
                || plain.startsWith("thân gửi") || plain.startsWith("kính chào") || plain.startsWith("xin chào")
                || plain.startsWith("chào")) {
            return contentHtml;
        }
        String name = recipientName == null ? "" : recipientName.strip();
        if (name.isEmpty()) name = vietnamese ? "Quý khách" : "Sir or Madam";
        String greeting = (vietnamese ? "Kính gửi " : "Dear ") + name + ",";
        return "<p style=\"margin:0 0 14px;\">" + escape(greeting) + "</p>" + contentHtml;
    }

    /** Plain text into paragraphs: escaped, a blank line separates paragraphs, a single line break stays. Text that already holds tags is kept as it is. */
    public static String paragraphs(String text) {
        if (text == null || text.isBlank()) return "";
        if (text.contains("<") && text.contains(">")) return text;
        StringBuilder sb = new StringBuilder();
        for (String paragraph : text.strip().split("\\R\\s*\\R")) {
            sb.append("<p style=\"margin:0 0 14px;\">").append(escape(paragraph.strip()).replaceAll("\\R", "<br>")).append("</p>");
        }
        return sb.toString();
    }

    /** The action button of an email. Empty when there is no web address. */
    public static String button(String label, String url, String brandColor) {
        return button(label, url, brandColor, false);
    }

    /** The action button, with the words around it in the language of the mail. */
    public static String button(String label, String url, String brandColor, boolean vietnamese) {
        return button(label, url, brandColor, vietnamese, null);
    }

    /** The sizes an administrator can give the button: padding, text size and corner. Anything else is the medium one. */
    private static String[] buttonSize(String size) {
        return switch (size == null ? "" : size) {
            case "SMALL" -> new String[] {"8px 18px", "13px", "8px"};
            case "LARGE" -> new String[] {"16px 36px", "17px", "12px"};
            default -> new String[] {"12px 26px", "15px", "10px"};
        };
    }

    public static String button(String label, String url, String brandColor, boolean vietnamese, String size) {
        return button(label, url, brandColor, vietnamese, size, true);
    }

    /** @param linkLine whether the address is also written under the button, for a mail program that does not show it */
    public static String button(String label, String url, String brandColor, boolean vietnamese, String size, boolean linkLine) {
        if (url == null || url.isBlank() || !(url.startsWith("http://") || url.startsWith("https://"))) return "";
        String text = label == null || label.isBlank() ? (vietnamese ? "Mở trong EQMS" : "Open in EQMS") : label.strip();
        String[] measures = buttonSize(size);
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:20px 0 8px;\"><tr><td style=\"border-radius:" + measures[2] + ";background:"
                + safeColor(brandColor) + ";\"><a href=\"" + escapeAttr(url) + "\" style=\"display:inline-block;padding:" + measures[0] + ";color:#ffffff;font-weight:700;font-size:" + measures[1] + ";text-decoration:none;border-radius:" + measures[2] + ";\">"
                + escape(text) + "</a></td></tr></table>"
                + (linkLine ? "<p style=\"margin:10px 0 0;font-size:12.5px;color:#6b7280;\">" + (vietnamese ? "Nếu nút không hoạt động, hãy sao chép liên kết này: " : "If the button does not work, copy this link: ") + "<span style=\"word-break:break-all;\">" + escape(url) + "</span></p>" : "");
    }

    /** The frame with the default header text (EQMS) for a mail with no logo. */
    public static String render(EmailDesign design, String contentHtml) {
        return render(design, contentHtml, null);
    }

    /** The frame as it is sent: the card on the grey page. */
    public static String render(EmailDesign design, String contentHtml, String headerTitle) {
        return render(design, contentHtml, headerTitle, false);
    }

    /**
     * @param headerTitle what the header says when the design has no logo (the Header Title of the general configuration); EQMS when blank
     * @param cardOnly    the card alone, without the grey page around it, for a preview that sits inside a screen
     */
    public static String render(EmailDesign design, String contentHtml, String headerTitle, boolean cardOnly) {
        String brand = safeColor(design == null ? null : design.getBrandColor());
        // the action button and the links have a colour of their own; the brand colour is only the header band
        String link = safeColor(design == null ? null : design.getButtonColor());
        String bodyBg = safeColor(design == null ? null : design.getBodyColor(), DEFAULT_BODY);
        String footBg = safeColor(design == null ? null : design.getFooterColor(), DEFAULT_FOOTER);
        String headText = safeColor(design == null ? null : design.getHeaderTextColor(), "#FFFFFF");
        String bodyText = safeColor(design == null ? null : design.getBodyTextColor(), "#334155");
        String footText = safeColor(design == null ? null : design.getFooterTextColor(), "#6B7280");
        String headFont = design == null || design.getHeaderFontFamily() == null || design.getHeaderFontFamily().isBlank() ? null : font(design.getHeaderFontFamily());
        String logoAlign = align(design == null ? null : design.getLogoAlign());
        String footAlign = align(design == null ? null : design.getFooterAlign());
        // the words in the header: the text of the design; only a design that has none falls back to the title the caller gives
        String own = design == null || design.getLogoText() == null ? "" : design.getLogoText().strip();
        String title = !own.isEmpty() ? own : headerTitle == null || headerTitle.isBlank() ? "EQMS" : headerTitle.strip();
        String font = font(design == null ? null : design.getFontFamily());
        String logo = design == null ? null : design.getLogoUrl();
        boolean vietnamese = contentHtml != null && contentHtml.contains(VIETNAMESE_MARK);
        String footer = design == null || design.getFooterText() == null ? "" : design.getFooterText().strip();
        if (vietnamese && design != null && design.getFooterTextVi() != null && !design.getFooterTextVi().isBlank()) {
            footer = design.getFooterTextVi().strip();
        }
        String support = design == null || design.getSupportEmail() == null ? "" : design.getSupportEmail().strip();
        String page = cardOnly ? "transparent" : "#f1f5f9";
        String padding = cardOnly ? "0" : "32px 16px";

        // the colours are the ones the design sets, in every mail app: no automatic dark scheme changes them
        StringBuilder sb = new StringBuilder(2048);
        sb.append("<!DOCTYPE html><html lang=\"").append(vietnamese ? "vi" : "en").append("\"><head><meta charset=\"UTF-8\" />")
          .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />")
          .append("<meta name=\"color-scheme\" content=\"light\" /><meta name=\"supported-color-schemes\" content=\"light\" />")
          .append("<style>")
          .append("body{margin:0;padding:0;background:").append(page).append(";}")
          .append("a{color:").append(link).append(";}")
          .append("h1,h2,h3{color:").append(bodyText).append(";margin:0 0 12px;line-height:1.3;}")
          .append("ul,ol{padding-left:20px;margin:0 0 14px;}")
          .append("table{border-collapse:collapse;}")
          .append("@media only screen and (max-width:620px){.eq-card{width:100%!important;border-radius:0!important;}.eq-body{padding:22px 20px!important;}.eq-head{padding:20px!important;}.eq-wrap{padding:0!important;}}")
          .append("</style></head><body style=\"margin:0;padding:0;background:").append(page).append(";\">")
          .append("<table class=\"eq-bg\" role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:").append(page).append(";\"><tr><td class=\"eq-wrap\" align=\"center\" style=\"padding:").append(padding).append(";\">")
          .append("<table class=\"eq-card\" role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:").append(cardOnly ? "100%" : "600px").append(";background:").append(bodyBg).append(";border-radius:").append(cardOnly ? "0" : "16px").append(";overflow:hidden;font-family:")
          .append(font).append(";\">")
          .append("<tr><td class=\"eq-head\" style=\"background:").append(brand).append(";padding:26px 40px;text-align:").append(logoAlign).append(";\">");
        if (logo != null && !logo.isBlank()) {
            sb.append("<img src=\"").append(escapeAttr(logo)).append("\" alt=\"Logo\" style=\"max-height:48px;max-width:220px;height:auto;width:auto;display:inline-block;\" />");
        } else {
            sb.append("<span style=\"").append(headFont == null ? "" : "font-family:" + headFont + ";").append("color:").append(headText).append(";font-size:20px;font-weight:800;letter-spacing:.4px;\">").append(escape(title)).append("</span>");
        }
        sb.append("</td></tr>")
          .append("<tr><td class=\"eq-body\" style=\"padding:34px 40px;font-size:15px;line-height:1.7;background:").append(bodyBg).append(";color:").append(bodyText).append(";\">").append(contentHtml == null ? "" : contentHtml).append("</td></tr>")
          .append("<tr><td class=\"eq-foot\" style=\"background:").append(footBg).append(";padding:20px 40px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.8;text-align:")
          .append(footAlign).append(";color:").append(footText).append(";\">");
        if (footer.isEmpty()) {
            sb.append("<div>&copy; ").append(Year.now().getValue()).append(vietnamese ? " EQMS. Đây là thư tự động, vui lòng không trả lời.</div>" : " EQMS. This is an automatic message, please do not reply.</div>");
        } else {
            sb.append("<div>").append(escape(footer.replace("{year}", String.valueOf(Year.now().getValue())))).append("</div>");
        }
        if (!support.isEmpty()) {
            sb.append("<div><a href=\"mailto:").append(escapeAttr(support)).append("\" style=\"color:").append(link).append(";text-decoration:none;font-weight:600;\">")
              .append(escape(support)).append("</a></div>");
        }
        sb.append("</td></tr></table></td></tr></table></body></html>");
        return sb.toString();
    }

    private static String font(String family) {
        String chosen = SAFE_FONTS.stream().filter(f -> f.equalsIgnoreCase(family)).findFirst().orElse("Arial");
        return "'" + chosen + "',Arial,Helvetica,sans-serif";
    }

    static String safeColor(String color) {
        return safeColor(color, "#059669");
    }

    static String safeColor(String color, String fallback) {
        return color != null && color.matches("#[0-9a-fA-F]{6}") ? color : fallback;
    }

    /** LEFT, CENTER or RIGHT as the CSS word; anything else is left. */
    static String align(String value) {
        if (value == null) return "left";
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "CENTER" -> "center";
            case "RIGHT" -> "right";
            default -> "left";
        };
    }


    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String text) {
        return escape(text).replace("\"", "&quot;");
    }
}
