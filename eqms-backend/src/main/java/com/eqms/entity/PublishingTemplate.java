package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "publishing_templates")
public class PublishingTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "template_name", nullable = false, unique = true, length = 160)
    private String templateName;

    @Column(name = "document_type", length = 120)
    private String documentType;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "cover_template_path", length = 1024)
    private String coverTemplatePath;

    @Column(name = "body_template_path", length = 1024)
    private String bodyTemplatePath;

    @Column(name = "header_template_path", length = 1024)
    private String headerTemplatePath;

    @Column(name = "footer_template_path", length = 1024)
    private String footerTemplatePath;

    @Column(name = "logo_template_path", length = 1024)
    private String logoTemplatePath;

    @Column(name = "cover_file_name", length = 255)
    private String coverFileName;

    @Column(name = "body_file_name", length = 255)
    private String bodyFileName;

    @Column(name = "header_file_name", length = 255)
    private String headerFileName;

    @Column(name = "footer_file_name", length = 255)
    private String footerFileName;

    @Column(name = "logo_file_name", length = 255)
    private String logoFileName;

    @Column(name = "cover_source_page_from")
    private Integer coverSourcePageFrom;

    @Column(name = "cover_source_page_to")
    private Integer coverSourcePageTo;

    @Column(name = "body_source_page_from")
    private Integer bodySourcePageFrom;

    @Column(name = "body_source_page_to")
    private Integer bodySourcePageTo;

    @Column(name = "header_page_from")
    private Integer headerPageFrom;

    @Column(name = "header_page_to")
    private Integer headerPageTo;

    @Column(name = "footer_page_from")
    private Integer footerPageFrom;

    @Column(name = "footer_page_to")
    private Integer footerPageTo;

    @Column(name = "watermark_page_from")
    private Integer watermarkPageFrom;

    @Column(name = "watermark_page_to")
    private Integer watermarkPageTo;

    @Column(name = "enable_header", nullable = false)
    private boolean enableHeader = true;

    @Column(name = "enable_footer", nullable = false)
    private boolean enableFooter = true;

    @Column(name = "show_logo", nullable = false)
    private boolean showLogo = true;

    @Column(name = "show_qr_code", nullable = false)
    private boolean showQrCode = false;

    @Column(name = "show_barcode", nullable = false)
    private boolean showBarcode = false;

    @Column(name = "show_confidentiality", nullable = false)
    private boolean showConfidentiality = true;

    @Column(name = "show_electronic_signature_information", nullable = false)
    private boolean showElectronicSignatureInformation = true;

    @Column(name = "publishing_mode", length = 40)
    private String publishingMode;

    @Column(name = "cover_orientation", length = 20)
    private String coverOrientation;

    @Column(name = "body_orientation", length = 20)
    private String bodyOrientation;

    @Column(name = "watermark_mode", length = 32)
    private String watermarkMode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "published_by", length = 100)
    private String publishedBy;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    public int getVersionNumber() {
        return versionNumber;
    }

    public void setVersionNumber(int versionNumber) {
        this.versionNumber = versionNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCoverTemplatePath() {
        return coverTemplatePath;
    }

    public void setCoverTemplatePath(String coverTemplatePath) {
        this.coverTemplatePath = coverTemplatePath;
    }

    public String getBodyTemplatePath() {
        return bodyTemplatePath;
    }

    public void setBodyTemplatePath(String bodyTemplatePath) {
        this.bodyTemplatePath = bodyTemplatePath;
    }

    public String getHeaderTemplatePath() {
        return headerTemplatePath;
    }

    public void setHeaderTemplatePath(String headerTemplatePath) {
        this.headerTemplatePath = headerTemplatePath;
    }

    public String getFooterTemplatePath() {
        return footerTemplatePath;
    }

    public void setFooterTemplatePath(String footerTemplatePath) {
        this.footerTemplatePath = footerTemplatePath;
    }

    public String getLogoTemplatePath() {
        return logoTemplatePath;
    }

    public void setLogoTemplatePath(String logoTemplatePath) {
        this.logoTemplatePath = logoTemplatePath;
    }

    public String getCoverFileName() {
        return coverFileName;
    }

    public void setCoverFileName(String coverFileName) {
        this.coverFileName = coverFileName;
    }

    public String getBodyFileName() {
        return bodyFileName;
    }

    public void setBodyFileName(String bodyFileName) {
        this.bodyFileName = bodyFileName;
    }

    public String getHeaderFileName() {
        return headerFileName;
    }

    public void setHeaderFileName(String headerFileName) {
        this.headerFileName = headerFileName;
    }

    public String getFooterFileName() {
        return footerFileName;
    }

    public void setFooterFileName(String footerFileName) {
        this.footerFileName = footerFileName;
    }

    public String getLogoFileName() {
        return logoFileName;
    }

    public void setLogoFileName(String logoFileName) {
        this.logoFileName = logoFileName;
    }

    public Integer getCoverSourcePageFrom() {
        return coverSourcePageFrom;
    }

    public void setCoverSourcePageFrom(Integer coverSourcePageFrom) {
        this.coverSourcePageFrom = coverSourcePageFrom;
    }

    public Integer getCoverSourcePageTo() {
        return coverSourcePageTo;
    }

    public void setCoverSourcePageTo(Integer coverSourcePageTo) {
        this.coverSourcePageTo = coverSourcePageTo;
    }

    public Integer getBodySourcePageFrom() {
        return bodySourcePageFrom;
    }

    public void setBodySourcePageFrom(Integer bodySourcePageFrom) {
        this.bodySourcePageFrom = bodySourcePageFrom;
    }

    public Integer getBodySourcePageTo() {
        return bodySourcePageTo;
    }

    public void setBodySourcePageTo(Integer bodySourcePageTo) {
        this.bodySourcePageTo = bodySourcePageTo;
    }

    public Integer getHeaderPageFrom() {
        return headerPageFrom;
    }

    public void setHeaderPageFrom(Integer headerPageFrom) {
        this.headerPageFrom = headerPageFrom;
    }

    public Integer getHeaderPageTo() {
        return headerPageTo;
    }

    public void setHeaderPageTo(Integer headerPageTo) {
        this.headerPageTo = headerPageTo;
    }

    public Integer getFooterPageFrom() {
        return footerPageFrom;
    }

    public void setFooterPageFrom(Integer footerPageFrom) {
        this.footerPageFrom = footerPageFrom;
    }

    public Integer getFooterPageTo() {
        return footerPageTo;
    }

    public void setFooterPageTo(Integer footerPageTo) {
        this.footerPageTo = footerPageTo;
    }

    public Integer getWatermarkPageFrom() {
        return watermarkPageFrom;
    }

    public void setWatermarkPageFrom(Integer watermarkPageFrom) {
        this.watermarkPageFrom = watermarkPageFrom;
    }

    public Integer getWatermarkPageTo() {
        return watermarkPageTo;
    }

    public void setWatermarkPageTo(Integer watermarkPageTo) {
        this.watermarkPageTo = watermarkPageTo;
    }

    public boolean isEnableHeader() {
        return enableHeader;
    }

    public void setEnableHeader(boolean enableHeader) {
        this.enableHeader = enableHeader;
    }

    public boolean isEnableFooter() {
        return enableFooter;
    }

    public void setEnableFooter(boolean enableFooter) {
        this.enableFooter = enableFooter;
    }

    public boolean isShowLogo() {
        return showLogo;
    }

    public void setShowLogo(boolean showLogo) {
        this.showLogo = showLogo;
    }

    public boolean isShowQrCode() {
        return showQrCode;
    }

    public void setShowQrCode(boolean showQrCode) {
        this.showQrCode = showQrCode;
    }

    public boolean isShowBarcode() {
        return showBarcode;
    }

    public void setShowBarcode(boolean showBarcode) {
        this.showBarcode = showBarcode;
    }

    public boolean isShowConfidentiality() {
        return showConfidentiality;
    }

    public void setShowConfidentiality(boolean showConfidentiality) {
        this.showConfidentiality = showConfidentiality;
    }

    public boolean isShowElectronicSignatureInformation() {
        return showElectronicSignatureInformation;
    }

    public void setShowElectronicSignatureInformation(boolean showElectronicSignatureInformation) {
        this.showElectronicSignatureInformation = showElectronicSignatureInformation;
    }

    public String getPublishingMode() {
        return publishingMode;
    }

    public void setPublishingMode(String publishingMode) {
        this.publishingMode = publishingMode;
    }

    public String getCoverOrientation() {
        return coverOrientation;
    }

    public void setCoverOrientation(String coverOrientation) {
        this.coverOrientation = coverOrientation;
    }

    public String getBodyOrientation() {
        return bodyOrientation;
    }

    public void setBodyOrientation(String bodyOrientation) {
        this.bodyOrientation = bodyOrientation;
    }

    public String getWatermarkMode() {
        return watermarkMode;
    }

    public void setWatermarkMode(String watermarkMode) {
        this.watermarkMode = watermarkMode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(String publishedBy) {
        this.publishedBy = publishedBy;
    }
}
