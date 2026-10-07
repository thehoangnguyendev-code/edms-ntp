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
 * One bulk recall of paper Controlled Copies by scan. Starts as {@code DRAFT} (files uploaded, malware scanned,
 * QR decoded, matched and reviewed by the DCO) and becomes {@code COMMITTED} with a single electronic signature that
 * covers the reviewed list, or {@code DISCARDED}. A committed batch is immutable.
 */
@Entity
@Table(name = "controlled_copy_recall_batches")
public class ControlledCopyRecallBatch {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_COMMITTED = "COMMITTED";
    public static final String STATUS_DISCARDED = "DISCARDED";

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "batch_number", nullable = false, unique = true, length = 40)
    private String batchNumber;

    @Column(nullable = false, length = 20)
    private String status = STATUS_DRAFT;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private UserAccount createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "committed_by_user_id")
    private UserAccount committedBy;

    @Column(name = "committed_at")
    private Instant committedAt;

    /** When the paper was physically received, as stated by the DCO at commit; the server time is {@code committedAt}. */
    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "recall_reason", columnDefinition = "TEXT")
    private String recallReason;

    @Column(name = "signature_id")
    private UUID signatureId;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public long getLockVersion() { return lockVersion; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UserAccount getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserAccount createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UserAccount getCommittedBy() { return committedBy; }
    public void setCommittedBy(UserAccount committedBy) { this.committedBy = committedBy; }
    public Instant getCommittedAt() { return committedAt; }
    public void setCommittedAt(Instant committedAt) { this.committedAt = committedAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
    public String getRecallReason() { return recallReason; }
    public void setRecallReason(String recallReason) { this.recallReason = recallReason; }
    public UUID getSignatureId() { return signatureId; }
    public void setSignatureId(UUID signatureId) { this.signatureId = signatureId; }
}
