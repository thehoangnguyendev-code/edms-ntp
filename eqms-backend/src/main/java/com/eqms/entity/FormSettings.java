package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per Document that has opted into producing Executed Records (a filled eForm or a
 * scanned paper copy). Decided per-Form by Author/DCO on the Document's own Workflow panel --
 * deliberately not a Document Type flag (mirrors how requiresTraining is a per-Document decision
 * made at creation, not a Document Type policy).
 */
@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "form_settings")
public class FormSettings {

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false, unique = true)
    private DocumentRecord document;

    @Column(name = "allow_eform", nullable = false)
    private boolean allowEform;

    @Column(name = "allow_paper", nullable = false)
    private boolean allowPaper;

    @Column(name = "require_approval", nullable = false)
    private boolean requireApproval;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_user_id")
    private UserAccount approver;

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

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public long getLockVersion() { return lockVersion; }
    public DocumentRecord getDocument() { return document; }
    public void setDocument(DocumentRecord document) { this.document = document; }
    public boolean isAllowEform() { return allowEform; }
    public void setAllowEform(boolean allowEform) { this.allowEform = allowEform; }
    public boolean isAllowPaper() { return allowPaper; }
    public void setAllowPaper(boolean allowPaper) { this.allowPaper = allowPaper; }
    public boolean isRequireApproval() { return requireApproval; }
    public void setRequireApproval(boolean requireApproval) { this.requireApproval = requireApproval; }
    public UserAccount getApprover() { return approver; }
    public void setApprover(UserAccount approver) { this.approver = approver; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
