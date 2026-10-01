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
 * A single execution of a Form -- either a filled eForm submission or a scanned paper Controlled
 * Copy -- tracked against its source Form {@link DocumentRecord}. Never spawns a new Document
 * Number: this is the fix for the prior workaround of uploading a scanned form back in as a
 * brand-new Document with type RECORD, which lost the machine-readable link to its source Form.
 * Rejection is terminal (status stays REJECTED, never reopened) -- once a signature exists on a
 * record, GxP practice is a fresh execution corrects it, not mutating signed data.
 */
@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "executed_records")
public class ExecutedRecord {

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "record_number", nullable = false, unique = true, length = 100)
    private String recordNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "form_document_id", nullable = false)
    private DocumentRecord formDocument;

    /** The Effective revision in force when this record was filled -- kept even after the Form is
     *  later upgraded, so traceability always answers "which exact revision was in force". */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "form_revision_id", nullable = false)
    private DocumentRevisionRecord formRevision;

    @Column(name = "capture_method", nullable = false, length = 20)
    private String captureMethod;

    @Column(nullable = false, length = 20)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "filled_by_user_id")
    private UserAccount filledBy;

    @Column(name = "filled_at")
    private Instant filledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_controlled_copy_id")
    private ControlledCopyRecord sourceControlledCopy;

    @Column(name = "storage_provider", length = 60)
    private String storageProvider;

    @Column(name = "storage_bucket", length = 255)
    private String storageBucket;

    @Column(name = "storage_object_key", length = 1024)
    private String storageObjectKey;

    @Column(name = "storage_version_id", length = 255)
    private String storageVersionId;

    @Column(length = 128)
    private String checksum;

    @Column(name = "submit_signature_id")
    private UUID submitSignatureId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_user_id")
    private UserAccount approvedBy;

    @Column(name = "approve_signature_id")
    private UUID approveSignatureId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rejected_by_user_id")
    private UserAccount rejectedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejected_reason", columnDefinition = "TEXT")
    private String rejectedReason;

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
    public String getRecordNumber() { return recordNumber; }
    public void setRecordNumber(String recordNumber) { this.recordNumber = recordNumber; }
    public DocumentRecord getFormDocument() { return formDocument; }
    public void setFormDocument(DocumentRecord formDocument) { this.formDocument = formDocument; }
    public DocumentRevisionRecord getFormRevision() { return formRevision; }
    public void setFormRevision(DocumentRevisionRecord formRevision) { this.formRevision = formRevision; }
    public String getCaptureMethod() { return captureMethod; }
    public void setCaptureMethod(String captureMethod) { this.captureMethod = captureMethod; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UserAccount getFilledBy() { return filledBy; }
    public void setFilledBy(UserAccount filledBy) { this.filledBy = filledBy; }
    public Instant getFilledAt() { return filledAt; }
    public void setFilledAt(Instant filledAt) { this.filledAt = filledAt; }
    public ControlledCopyRecord getSourceControlledCopy() { return sourceControlledCopy; }
    public void setSourceControlledCopy(ControlledCopyRecord sourceControlledCopy) { this.sourceControlledCopy = sourceControlledCopy; }
    public String getStorageProvider() { return storageProvider; }
    public void setStorageProvider(String storageProvider) { this.storageProvider = storageProvider; }
    public String getStorageBucket() { return storageBucket; }
    public void setStorageBucket(String storageBucket) { this.storageBucket = storageBucket; }
    public String getStorageObjectKey() { return storageObjectKey; }
    public void setStorageObjectKey(String storageObjectKey) { this.storageObjectKey = storageObjectKey; }
    public String getStorageVersionId() { return storageVersionId; }
    public void setStorageVersionId(String storageVersionId) { this.storageVersionId = storageVersionId; }
    public String getChecksum() { return checksum; }
    public void setChecksum(String checksum) { this.checksum = checksum; }
    public UUID getSubmitSignatureId() { return submitSignatureId; }
    public void setSubmitSignatureId(UUID submitSignatureId) { this.submitSignatureId = submitSignatureId; }
    public UserAccount getApprovedBy() { return approvedBy; }
    public void setApprovedBy(UserAccount approvedBy) { this.approvedBy = approvedBy; }
    public UUID getApproveSignatureId() { return approveSignatureId; }
    public void setApproveSignatureId(UUID approveSignatureId) { this.approveSignatureId = approveSignatureId; }
    public UserAccount getRejectedBy() { return rejectedBy; }
    public void setRejectedBy(UserAccount rejectedBy) { this.rejectedBy = rejectedBy; }
    public Instant getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(Instant rejectedAt) { this.rejectedAt = rejectedAt; }
    public String getRejectedReason() { return rejectedReason; }
    public void setRejectedReason(String rejectedReason) { this.rejectedReason = rejectedReason; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
