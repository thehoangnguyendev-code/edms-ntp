package com.eqms.entity;

import com.eqms.util.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "electronic_signature_meanings")
public class ElectronicSignatureMeaning {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "requires_reason", nullable = false)
    private boolean requiresReason = true;

    /** HIDDEN | OPTIONAL | REQUIRED */
    @Column(name = "comment_rule", length = 20, nullable = false)
    private String commentRule = "OPTIONAL";

    @Column(name = "requires_comment", nullable = false)
    private boolean requiresComment;

    @Convert(converter = StringListConverter.class)
    @Column(name = "allowed_reasons", columnDefinition = "TEXT")
    private List<String> allowedReasons = new ArrayList<>();

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        syncRequiresComment();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        syncRequiresComment();
    }

    private void syncRequiresComment() {
        this.requiresComment = "REQUIRED".equalsIgnoreCase(this.commentRule);
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isRequiresReason() { return requiresReason; }
    public void setRequiresReason(boolean requiresReason) { this.requiresReason = requiresReason; }
    public String getCommentRule() { return commentRule != null ? commentRule : "OPTIONAL"; }
    public void setCommentRule(String commentRule) { this.commentRule = commentRule; }
    public boolean isRequiresComment() { return "REQUIRED".equalsIgnoreCase(getCommentRule()); }
    public List<String> getAllowedReasons() { return allowedReasons != null ? allowedReasons : new ArrayList<>(); }
    public void setAllowedReasons(List<String> allowedReasons) { this.allowedReasons = allowedReasons; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
