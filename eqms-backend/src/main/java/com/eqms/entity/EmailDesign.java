package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** The one look every email of the system shares: logo, colour, font and footer (owner decision D2, 2026-11-12). There is exactly one row. */
@Entity
@Table(name = "email_design")
public class EmailDesign {

    @Id
    private UUID id;

    @Column(name = "logo_url", columnDefinition = "text")
    private String logoUrl;

    /** The words in the header when there is no logo picture (plain text, never markup). */
    @Column(name = "logo_text", length = 200)
    private String logoText;

    /** The colour of the action button and of the links. */
    @Column(name = "button_color", nullable = false, length = 20)
    private String buttonColor = "#059669";

    @Column(name = "brand_color", nullable = false, length = 20)
    private String brandColor = "#059669";

    @Column(name = "font_family", nullable = false, length = 100)
    private String fontFamily = "Arial";

    @Column(name = "footer_text", columnDefinition = "text")
    private String footerText;

    /** SMALL, MEDIUM or LARGE. */
    @Column(name = "button_size", nullable = false, length = 10)
    private String buttonSize = "MEDIUM";

    @Column(name = "show_button_link", nullable = false)
    private boolean showButtonLink = true;

    /** The footer of a mail sent in Vietnamese; empty: the footer above. */
    @Column(name = "footer_text_vi", columnDefinition = "text")
    private String footerTextVi;

    @Column(name = "support_email", length = 255)
    private String supportEmail;

    /** The font of the words in the header; null means the font of the body. */
    @Column(name = "header_font_family", length = 100)
    private String headerFontFamily;

    @Column(name = "header_text_color", nullable = false, length = 20)
    private String headerTextColor = "#FFFFFF";

    @Column(name = "body_text_color", nullable = false, length = 20)
    private String bodyTextColor = "#334155";

    @Column(name = "footer_text_color", nullable = false, length = 20)
    private String footerTextColor = "#6B7280";

    @Column(name = "body_color", nullable = false, length = 20)
    private String bodyColor = "#FFFFFF";

    @Column(name = "footer_color", nullable = false, length = 20)
    private String footerColor = "#F8FAFC";

    /** LEFT, CENTER or RIGHT. */
    @Column(name = "logo_align", nullable = false, length = 10)
    private String logoAlign = "LEFT";

    /** LEFT, CENTER or RIGHT. */
    @Column(name = "footer_align", nullable = false, length = 10)
    private String footerAlign = "LEFT";

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getLogoText() { return logoText; }
    public void setLogoText(String logoText) { this.logoText = logoText; }
    public String getButtonColor() { return buttonColor; }
    public void setButtonColor(String buttonColor) { this.buttonColor = buttonColor; }
    public String getBrandColor() { return brandColor; }
    public void setBrandColor(String brandColor) { this.brandColor = brandColor; }
    public String getFontFamily() { return fontFamily; }
    public void setFontFamily(String fontFamily) { this.fontFamily = fontFamily; }
    public String getFooterText() { return footerText; }
    public void setFooterText(String footerText) { this.footerText = footerText; }
    public String getButtonSize() { return buttonSize; }
    public void setButtonSize(String buttonSize) { this.buttonSize = buttonSize; }
    public boolean isShowButtonLink() { return showButtonLink; }
    public void setShowButtonLink(boolean showButtonLink) { this.showButtonLink = showButtonLink; }
    public String getFooterTextVi() { return footerTextVi; }
    public void setFooterTextVi(String footerTextVi) { this.footerTextVi = footerTextVi; }
    public String getSupportEmail() { return supportEmail; }
    public void setSupportEmail(String supportEmail) { this.supportEmail = supportEmail; }
    public String getHeaderFontFamily() { return headerFontFamily; }
    public void setHeaderFontFamily(String headerFontFamily) { this.headerFontFamily = headerFontFamily; }
    public String getHeaderTextColor() { return headerTextColor; }
    public void setHeaderTextColor(String headerTextColor) { this.headerTextColor = headerTextColor; }
    public String getBodyTextColor() { return bodyTextColor; }
    public void setBodyTextColor(String bodyTextColor) { this.bodyTextColor = bodyTextColor; }
    public String getFooterTextColor() { return footerTextColor; }
    public void setFooterTextColor(String footerTextColor) { this.footerTextColor = footerTextColor; }
    public String getBodyColor() { return bodyColor; }
    public void setBodyColor(String bodyColor) { this.bodyColor = bodyColor; }
    public String getFooterColor() { return footerColor; }
    public void setFooterColor(String footerColor) { this.footerColor = footerColor; }
    public String getLogoAlign() { return logoAlign; }
    public void setLogoAlign(String logoAlign) { this.logoAlign = logoAlign; }
    public String getFooterAlign() { return footerAlign; }
    public void setFooterAlign(String footerAlign) { this.footerAlign = footerAlign; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
