package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "publishing_template_placeholder_styles",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_publishing_template_placeholder_style",
                columnNames = {"template_id", "template_version_number", "component_type", "layout", "placeholder_key"}
        )
)
public class PublishingTemplatePlaceholderStyle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private PublishingTemplate template;

    @Column(name = "template_version_id")
    private UUID templateVersionId;

    @Column(name = "template_version_number", nullable = false)
    private int templateVersionNumber;

    @Column(name = "component_type", nullable = false, length = 20)
    private String componentType;

    @Column(name = "layout", nullable = false, length = 20)
    private String layout;

    @Column(name = "placeholder_key", nullable = false, length = 160)
    private String placeholderKey;

    @Column(name = "placeholder_token", nullable = false, length = 255)
    private String placeholderToken;

    @Column(name = "placeholder_type", nullable = false, length = 40)
    private String placeholderType;

    @Column(name = "style_json", columnDefinition = "TEXT", nullable = false)
    private String styleJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

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

    public PublishingTemplate getTemplate() {
        return template;
    }

    public void setTemplate(PublishingTemplate template) {
        this.template = template;
    }

    public UUID getTemplateVersionId() {
        return templateVersionId;
    }

    public void setTemplateVersionId(UUID templateVersionId) {
        this.templateVersionId = templateVersionId;
    }

    public int getTemplateVersionNumber() {
        return templateVersionNumber;
    }

    public void setTemplateVersionNumber(int templateVersionNumber) {
        this.templateVersionNumber = templateVersionNumber;
    }

    public String getComponentType() {
        return componentType;
    }

    public void setComponentType(String componentType) {
        this.componentType = componentType;
    }

    public String getLayout() {
        return layout;
    }

    public void setLayout(String layout) {
        this.layout = layout;
    }

    public String getPlaceholderKey() {
        return placeholderKey;
    }

    public void setPlaceholderKey(String placeholderKey) {
        this.placeholderKey = placeholderKey;
    }

    public String getPlaceholderToken() {
        return placeholderToken;
    }

    public void setPlaceholderToken(String placeholderToken) {
        this.placeholderToken = placeholderToken;
    }

    public String getPlaceholderType() {
        return placeholderType;
    }

    public void setPlaceholderType(String placeholderType) {
        this.placeholderType = placeholderType;
    }

    public String getStyleJson() {
        return styleJson;
    }

    public void setStyleJson(String styleJson) {
        this.styleJson = styleJson;
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
}
