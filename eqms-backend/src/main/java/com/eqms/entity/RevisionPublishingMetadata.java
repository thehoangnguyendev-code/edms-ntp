package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "revision_publishing_metadata")
public class RevisionPublishingMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "revision_id", nullable = false, unique = true)
    private DocumentRevisionRecord revision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "publishing_template_id")
    private PublishingTemplate publishingTemplate;

    @Column(name = "publishing_template_version")
    private Integer publishingTemplateVersion;

    @Column(name = "selected_publishing_layout", length = 20)
    private String selectedPublishingLayout;

    @Column(name = "publishing_preview_pdf_path", length = 1024)
    private String publishingPreviewPdfPath;

    @Column(name = "publishing_preview_checksum", length = 128)
    private String publishingPreviewChecksum;

    @Column(name = "publishing_preview_version_id", length = 255)
    private String publishingPreviewVersionId;

    @Column(name = "published_pdf_path", length = 1024)
    private String publishedPdfPath;

    @Column(name = "published_pdf_checksum", length = 128)
    private String publishedPdfChecksum;

    @Column(name = "published_pdf_version_id", length = 255)
    private String publishedPdfVersionId;

    @Column(name = "conversion_engine", length = 100)
    private String conversionEngine;

    @Column(name = "preview_generated_at")
    private Instant previewGeneratedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preview_generated_by_user_id")
    private UserAccount previewGeneratedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_by_user_id")
    private UserAccount publishedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public DocumentRevisionRecord getRevision() {
        return revision;
    }

    public void setRevision(DocumentRevisionRecord revision) {
        this.revision = revision;
    }

    public PublishingTemplate getPublishingTemplate() {
        return publishingTemplate;
    }

    public void setPublishingTemplate(PublishingTemplate publishingTemplate) {
        this.publishingTemplate = publishingTemplate;
    }

    public Integer getPublishingTemplateVersion() {
        return publishingTemplateVersion;
    }

    public void setPublishingTemplateVersion(Integer publishingTemplateVersion) {
        this.publishingTemplateVersion = publishingTemplateVersion;
    }

    public String getSelectedPublishingLayout() {
        return selectedPublishingLayout;
    }

    public void setSelectedPublishingLayout(String selectedPublishingLayout) {
        this.selectedPublishingLayout = selectedPublishingLayout;
    }

    public String getPublishingPreviewPdfPath() {
        return publishingPreviewPdfPath;
    }

    public void setPublishingPreviewPdfPath(String publishingPreviewPdfPath) {
        this.publishingPreviewPdfPath = publishingPreviewPdfPath;
    }

    public String getPublishingPreviewChecksum() {
        return publishingPreviewChecksum;
    }

    public void setPublishingPreviewChecksum(String publishingPreviewChecksum) {
        this.publishingPreviewChecksum = publishingPreviewChecksum;
    }

    public String getPublishingPreviewVersionId() {
        return publishingPreviewVersionId;
    }

    public void setPublishingPreviewVersionId(String publishingPreviewVersionId) {
        this.publishingPreviewVersionId = publishingPreviewVersionId;
    }

    public String getPublishedPdfPath() {
        return publishedPdfPath;
    }

    public void setPublishedPdfPath(String publishedPdfPath) {
        this.publishedPdfPath = publishedPdfPath;
    }

    public String getPublishedPdfChecksum() {
        return publishedPdfChecksum;
    }

    public void setPublishedPdfChecksum(String publishedPdfChecksum) {
        this.publishedPdfChecksum = publishedPdfChecksum;
    }

    public String getPublishedPdfVersionId() {
        return publishedPdfVersionId;
    }

    public void setPublishedPdfVersionId(String publishedPdfVersionId) {
        this.publishedPdfVersionId = publishedPdfVersionId;
    }

    public String getConversionEngine() {
        return conversionEngine;
    }

    public void setConversionEngine(String conversionEngine) {
        this.conversionEngine = conversionEngine;
    }

    public Instant getPreviewGeneratedAt() {
        return previewGeneratedAt;
    }

    public void setPreviewGeneratedAt(Instant previewGeneratedAt) {
        this.previewGeneratedAt = previewGeneratedAt;
    }

    public UserAccount getPreviewGeneratedBy() {
        return previewGeneratedBy;
    }

    public void setPreviewGeneratedBy(UserAccount previewGeneratedBy) {
        this.previewGeneratedBy = previewGeneratedBy;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public UserAccount getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(UserAccount publishedBy) {
        this.publishedBy = publishedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
