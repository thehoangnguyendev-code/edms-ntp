package com.eqms.entity;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * A copy of an Effective document/revision issued for reference (external submission,
 * customer/auditor reference, etc.) that the system does NOT track or recall after issuance --
 * unlike {@link ControlledCopyRecord}. Deliberately a separate table/entity, not a subtype or
 * discriminator on ControlledCopyRecord, so validation/audit can never cross-contaminate between
 * the two concepts (see the approved plan).
 */
@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "uncontrolled_copies")
public class UncontrolledCopyRecord {

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revision_id", nullable = false)
    private DocumentRevisionRecord revision;

    @Column(name = "uncontrolled_copy_number", nullable = false, unique = true, length = 100)
    private String uncontrolledCopyNumber;

    @Column(name = "document_number", nullable = false, length = 100)
    private String documentNumber;

    @Column(name = "document_title", length = 500)
    private String documentTitle;

    @Column(name = "revision_number", length = 50)
    private String revisionNumber;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "status_code", nullable = false, length = 40)
    private String statusCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private UserAccount requestedBy;

    @Column(name = "requested_at")
    private Instant requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_user_id")
    private UserAccount approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rejected_by_user_id")
    private UserAccount rejectedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_by_user_id")
    private UserAccount generatedBy;

    @Column(name = "generated_at")
    private Instant generatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "distributed_by_user_id")
    private UserAccount distributedBy;

    @Column(name = "distributed_at")
    private Instant distributedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_user_id")
    private UserAccount cancelledBy;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    /** Recipient details captured when the copy was distributed; never re-read from the user's profile afterwards. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recipient_snapshot", columnDefinition = "jsonb")
    private JsonNode recipientSnapshot;

    @Column(name = "uncontrolled_copy_file_path", length = 1024)
    private String uncontrolledCopyFilePath;

    @Column(name = "uncontrolled_copy_storage_provider", length = 60)
    private String uncontrolledCopyStorageProvider;

    @Column(name = "uncontrolled_copy_storage_bucket", length = 255)
    private String uncontrolledCopyStorageBucket;

    @Column(name = "uncontrolled_copy_storage_object_key", length = 1024)
    private String uncontrolledCopyStorageObjectKey;

    @Column(name = "uncontrolled_copy_storage_version_id", length = 255)
    private String uncontrolledCopyStorageVersionId;

    @Column(name = "uncontrolled_copy_checksum", length = 128)
    private String uncontrolledCopyChecksum;

    /** True once the mandatory watermark/stamp was burned into the stored PDF. */
    @Column(name = "marking_applied", nullable = false)
    private boolean markingApplied;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "marking_layout", columnDefinition = "jsonb")
    private JsonNode markingLayout;

    @Column(name = "valid_until")
    private Instant validUntil;

    @Column(name = "download_count", nullable = false)
    private int downloadCount;

    @Column(name = "last_downloaded_at")
    private Instant lastDownloadedAt;

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
    public DocumentRevisionRecord getRevision() { return revision; }
    public void setRevision(DocumentRevisionRecord revision) { this.revision = revision; }
    public String getUncontrolledCopyNumber() { return uncontrolledCopyNumber; }
    public void setUncontrolledCopyNumber(String uncontrolledCopyNumber) { this.uncontrolledCopyNumber = uncontrolledCopyNumber; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }
    public String getRevisionNumber() { return revisionNumber; }
    public void setRevisionNumber(String revisionNumber) { this.revisionNumber = revisionNumber; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusCode() { return statusCode; }
    public void setStatusCode(String statusCode) { this.statusCode = statusCode; }
    public UserAccount getRequestedBy() { return requestedBy; }
    public void setRequestedBy(UserAccount requestedBy) { this.requestedBy = requestedBy; }
    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
    public UserAccount getApprovedBy() { return approvedBy; }
    public void setApprovedBy(UserAccount approvedBy) { this.approvedBy = approvedBy; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public UserAccount getRejectedBy() { return rejectedBy; }
    public void setRejectedBy(UserAccount rejectedBy) { this.rejectedBy = rejectedBy; }
    public Instant getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(Instant rejectedAt) { this.rejectedAt = rejectedAt; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public UserAccount getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(UserAccount generatedBy) { this.generatedBy = generatedBy; }
    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant generatedAt) { this.generatedAt = generatedAt; }
    public UserAccount getDistributedBy() { return distributedBy; }
    public void setDistributedBy(UserAccount distributedBy) { this.distributedBy = distributedBy; }
    public Instant getDistributedAt() { return distributedAt; }
    public void setDistributedAt(Instant distributedAt) { this.distributedAt = distributedAt; }
    public UserAccount getCancelledBy() { return cancelledBy; }
    public void setCancelledBy(UserAccount cancelledBy) { this.cancelledBy = cancelledBy; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    public JsonNode getRecipientSnapshot() { return recipientSnapshot; }
    public void setRecipientSnapshot(JsonNode recipientSnapshot) { this.recipientSnapshot = recipientSnapshot; }
    public String getUncontrolledCopyFilePath() { return uncontrolledCopyFilePath; }
    public void setUncontrolledCopyFilePath(String uncontrolledCopyFilePath) { this.uncontrolledCopyFilePath = uncontrolledCopyFilePath; }
    public String getUncontrolledCopyStorageProvider() { return uncontrolledCopyStorageProvider; }
    public void setUncontrolledCopyStorageProvider(String uncontrolledCopyStorageProvider) { this.uncontrolledCopyStorageProvider = uncontrolledCopyStorageProvider; }
    public String getUncontrolledCopyStorageBucket() { return uncontrolledCopyStorageBucket; }
    public void setUncontrolledCopyStorageBucket(String uncontrolledCopyStorageBucket) { this.uncontrolledCopyStorageBucket = uncontrolledCopyStorageBucket; }
    public String getUncontrolledCopyStorageObjectKey() { return uncontrolledCopyStorageObjectKey; }
    public void setUncontrolledCopyStorageObjectKey(String uncontrolledCopyStorageObjectKey) { this.uncontrolledCopyStorageObjectKey = uncontrolledCopyStorageObjectKey; }
    public String getUncontrolledCopyStorageVersionId() { return uncontrolledCopyStorageVersionId; }
    public void setUncontrolledCopyStorageVersionId(String uncontrolledCopyStorageVersionId) { this.uncontrolledCopyStorageVersionId = uncontrolledCopyStorageVersionId; }
    public String getUncontrolledCopyChecksum() { return uncontrolledCopyChecksum; }
    public void setUncontrolledCopyChecksum(String uncontrolledCopyChecksum) { this.uncontrolledCopyChecksum = uncontrolledCopyChecksum; }
    public boolean isMarkingApplied() { return markingApplied; }
    public void setMarkingApplied(boolean markingApplied) { this.markingApplied = markingApplied; }
    public JsonNode getMarkingLayout() { return markingLayout; }
    public void setMarkingLayout(JsonNode markingLayout) { this.markingLayout = markingLayout; }
    public Instant getValidUntil() { return validUntil; }
    public void setValidUntil(Instant validUntil) { this.validUntil = validUntil; }
    public int getDownloadCount() { return downloadCount; }
    public void setDownloadCount(int downloadCount) { this.downloadCount = downloadCount; }
    public Instant getLastDownloadedAt() { return lastDownloadedAt; }
    public void setLastDownloadedAt(Instant lastDownloadedAt) { this.lastDownloadedAt = lastDownloadedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
