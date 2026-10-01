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
import java.time.LocalDate;
import java.util.UUID;

@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "controlled_copies")
public class ControlledCopyRecord {

    @Id
    private UUID id;

    // Optimistic locking -- see DocumentRecord.lockVersion for rationale. Deliberately does NOT
    // protect consumeDownload/consumePrint in ControlledCopyRepository -- those are atomic
    // conditional bulk UPDATEs (WHERE downloadCount < 1) that don't need it; they already can't
    // race each other by construction.
    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revision_id", nullable = false)
    private DocumentRevisionRecord revision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "distribution_batch_id")
    private ControlledCopyDistributionBatch distributionBatch;

    @Column(name = "controlled_copy_number", nullable = false, unique = true, length = 100)
    private String controlledCopyNumber;

    @Column(name = "copy_number", nullable = false)
    private int copyNumber;

    @Column(name = "total_copies", nullable = false)
    private int totalCopies;

    @Column(name = "document_number", nullable = false, length = 100)
    private String documentNumber;

    /** PAPER (default, zero behavior change for every non-Form document) or ELECTRONIC -- only
     *  selectable when the target Document's FormSettings.allowEform is true. ELECTRONIC drives
     *  the eForm Fill/Sign flow (see EformEditSessionService / EformSignerAssignment) instead of
     *  the print-and-scan-back paper path. */
    @Column(name = "delivery_mode", nullable = false, length = 20)
    private String deliveryMode = "PAPER";

    @Column(name = "document_title", length = 500)
    private String documentTitle;

    @Column(name = "revision_number", length = 50)
    private String revisionNumber;

    @Column(name = "business_unit_name", length = 255)
    private String businessUnitName;

    @Column(name = "department_name", length = 255)
    private String departmentName;

    @Column(name = "distribution_list", columnDefinition = "TEXT")
    private String distributionList;

    @Column(name = "distribution_mode", length = 20)
    private String distributionMode;

    @Column(name = "distribution_scope", length = 50)
    private String distributionScope;

    @Column(length = 255)
    private String location;

    @Column(name = "location_code", length = 120)
    private String locationCode;

    @Column(name = "request_reason", columnDefinition = "TEXT")
    private String requestReason;

    @Column(name = "external_recipients", columnDefinition = "TEXT")
    private String externalRecipients;

    @Column(name = "obsolete_reason", length = 80)
    private String obsoleteReason;

    @Column(name = "controlled_copy_file_path", length = 1024)
    private String controlledCopyFilePath;

    @Column(name = "controlled_copy_storage_provider", length = 60)
    private String controlledCopyStorageProvider;

    @Column(name = "controlled_copy_storage_bucket", length = 255)
    private String controlledCopyStorageBucket;

    @Column(name = "controlled_copy_storage_object_key", length = 1024)
    private String controlledCopyStorageObjectKey;

    @Column(name = "controlled_copy_storage_version_id", length = 255)
    private String controlledCopyStorageVersionId;

    @Column(name = "controlled_copy_checksum", length = 128)
    private String controlledCopyChecksum;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_placeholder_values", columnDefinition = "jsonb")
    private JsonNode customPlaceholderValues;

    /** True once the stamp/watermark was burned into the stored PDF (the on-screen overlay is then skipped). */
    @Column(name = "marking_applied", nullable = false)
    private boolean markingApplied;

    /** Where the issue-time stamp/watermark were drawn (see ControlledCopyPdfMarkingService.Placement); null for older copies. */
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "marking_layout", columnDefinition = "jsonb")
    private JsonNode markingLayout;

    /** Recipient details captured when the copy was distributed; never re-read from the user's profile afterwards. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recipient_snapshot", columnDefinition = "jsonb")
    private JsonNode recipientSnapshot;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "status_code", nullable = false, length = 40)
    private String statusCode;

    @Column(name = "current_stage", length = 60)
    private String currentStage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private UserAccount requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by_user_id")
    private UserAccount openedBy;

    @Column(name = "requested_at")
    private Instant requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by_user_id")
    private UserAccount approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "printed_by_user_id")
    private UserAccount printedBy;

    @Column(name = "printed_at")
    private Instant printedAt;

    @Column(name = "download_count", nullable = false)
    private int downloadCount = 0;

    @Column(name = "print_count", nullable = false)
    private int printCount = 0;

    @Column(name = "last_downloaded_at")
    private Instant lastDownloadedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "distributed_by_user_id")
    private UserAccount distributedBy;

    @Column(name = "distributed_at")
    private Instant distributedAt;

    @Column(name = "recipient_name", length = 255)
    private String recipientName;

    @Column(name = "distribution_comment", columnDefinition = "TEXT")
    private String distributionComment;

    @Column(name = "recipient_signature", length = 255)
    private String recipientSignature;

    @Column(name = "recipient_date")
    private LocalDate recipientDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id")
    private UserAccount recipientUser;

    @Column(name = "access_token", length = 128, unique = true)
    private String accessToken;

    @Column(name = "access_token_issued_at")
    private Instant accessTokenIssuedAt;

    @Column(name = "preview_password_hash", length = 100)
    private String previewPasswordHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recalled_by_user_id")
    private UserAccount recalledBy;

    @Column(name = "recalled_at")
    private Instant recalledAt;

    @Column(name = "recall_reason", columnDefinition = "TEXT")
    private String recallReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destroyed_by_user_id")
    private UserAccount destroyedBy;

    @Column(name = "destroyed_at")
    private Instant destroyedAt;

    @Column(name = "destroy_reason", columnDefinition = "TEXT")
    private String destroyReason;

    @Column(name = "destruction_method", length = 255)
    private String destructionMethod;

    @Column(name = "destruction_type", length = 40)
    private String destructionType;

    @Column(name = "witnessed_by", length = 255)
    private String witnessedBy;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "has_expiry_date", nullable = false)
    private Boolean hasExpiryDate = false;

    @Column(name = "expiry_date")
    private Instant expiryDate;

    /**
     * True when {@link #expiryDate} was defaulted from the Controlled Copy Expiry Policy's
     * duration (not an explicit date chosen by the requester). Such a policy-derived expiry is
     * recomputed as {@code distributedAt + duration} at Distribute time, so a copy that sits in
     * Ready for Distribution never expires before anyone had the chance to distribute it. An
     * explicit requester-chosen expiry date is a fixed deadline and is never recomputed.
     */
    @Column(name = "expiry_anchored_to_distribution", nullable = false)
    private Boolean expiryAnchoredToDistribution = false;

    @Column(name = "expiry_reminder_sent_at")
    private Instant expiryReminderSentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "obsoleted_by_user_id")
    private UserAccount obsoletedBy;

    @Column(name = "obsoleted_at")
    private Instant obsoletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_user_id")
    private UserAccount cancelledBy;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    // Set only on the new record created by Reissue (replaceLostDamaged), pointing back
    // to the original Lost/Damaged record it replaces. The reverse direction (finding the
    // replacement for an original record) is a repository lookup, not a mapped field.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replaced_controlled_copy_id")
    private ControlledCopyRecord replacedControlledCopy;

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
    public ControlledCopyDistributionBatch getDistributionBatch() { return distributionBatch; }
    public void setDistributionBatch(ControlledCopyDistributionBatch distributionBatch) { this.distributionBatch = distributionBatch; }
    public String getControlledCopyNumber() { return controlledCopyNumber; }
    public void setControlledCopyNumber(String controlledCopyNumber) { this.controlledCopyNumber = controlledCopyNumber; }
    public int getCopyNumber() { return copyNumber; }
    public void setCopyNumber(int copyNumber) { this.copyNumber = copyNumber; }
    public int getTotalCopies() { return totalCopies; }
    public void setTotalCopies(int totalCopies) { this.totalCopies = totalCopies; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(String deliveryMode) { this.deliveryMode = deliveryMode; }
    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }
    public String getRevisionNumber() { return revisionNumber; }
    public void setRevisionNumber(String revisionNumber) { this.revisionNumber = revisionNumber; }
    public String getBusinessUnitName() { return businessUnitName; }
    public void setBusinessUnitName(String businessUnitName) { this.businessUnitName = businessUnitName; }
    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }
    public String getDistributionList() { return distributionList; }
    public void setDistributionList(String distributionList) { this.distributionList = distributionList; }
    public String getDistributionMode() { return distributionMode; }
    public void setDistributionMode(String distributionMode) { this.distributionMode = distributionMode; }
    public String getDistributionScope() { return distributionScope; }
    public void setDistributionScope(String distributionScope) { this.distributionScope = distributionScope; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getLocationCode() { return locationCode; }
    public void setLocationCode(String locationCode) { this.locationCode = locationCode; }
    public String getRequestReason() { return requestReason; }
    public void setRequestReason(String requestReason) { this.requestReason = requestReason; }
    public String getExternalRecipients() { return externalRecipients; }
    public void setExternalRecipients(String externalRecipients) { this.externalRecipients = externalRecipients; }
    public String getObsoleteReason() { return obsoleteReason; }
    public void setObsoleteReason(String obsoleteReason) { this.obsoleteReason = obsoleteReason; }
    public String getControlledCopyFilePath() { return controlledCopyFilePath; }
    public void setControlledCopyFilePath(String controlledCopyFilePath) { this.controlledCopyFilePath = controlledCopyFilePath; }
    public String getControlledCopyStorageProvider() { return controlledCopyStorageProvider; }
    public void setControlledCopyStorageProvider(String controlledCopyStorageProvider) { this.controlledCopyStorageProvider = controlledCopyStorageProvider; }
    public String getControlledCopyStorageBucket() { return controlledCopyStorageBucket; }
    public void setControlledCopyStorageBucket(String controlledCopyStorageBucket) { this.controlledCopyStorageBucket = controlledCopyStorageBucket; }
    public String getControlledCopyStorageObjectKey() { return controlledCopyStorageObjectKey; }
    public void setControlledCopyStorageObjectKey(String controlledCopyStorageObjectKey) { this.controlledCopyStorageObjectKey = controlledCopyStorageObjectKey; }
    public String getControlledCopyStorageVersionId() { return controlledCopyStorageVersionId; }
    public void setControlledCopyStorageVersionId(String controlledCopyStorageVersionId) { this.controlledCopyStorageVersionId = controlledCopyStorageVersionId; }
    public String getControlledCopyChecksum() { return controlledCopyChecksum; }
    public void setControlledCopyChecksum(String controlledCopyChecksum) { this.controlledCopyChecksum = controlledCopyChecksum; }
    public JsonNode getMarkingLayout() { return markingLayout; }
    public void setMarkingLayout(JsonNode markingLayout) { this.markingLayout = markingLayout; }
    public boolean isMarkingApplied() { return markingApplied; }
    public void setMarkingApplied(boolean markingApplied) { this.markingApplied = markingApplied; }
    public JsonNode getRecipientSnapshot() { return recipientSnapshot; }
    public void setRecipientSnapshot(JsonNode recipientSnapshot) { this.recipientSnapshot = recipientSnapshot; }
    public JsonNode getCustomPlaceholderValues() { return customPlaceholderValues; }
    public void setCustomPlaceholderValues(JsonNode customPlaceholderValues) { this.customPlaceholderValues = customPlaceholderValues; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusCode() { return statusCode; }
    public void setStatusCode(String statusCode) { this.statusCode = statusCode; }
    public String getCurrentStage() { return currentStage; }
    public void setCurrentStage(String currentStage) { this.currentStage = currentStage; }
    public UserAccount getRequestedBy() { return requestedBy; }
    public void setRequestedBy(UserAccount requestedBy) { this.requestedBy = requestedBy; }
    public UserAccount getOpenedBy() { return openedBy; }
    public void setOpenedBy(UserAccount openedBy) { this.openedBy = openedBy; }
    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
    public UserAccount getApprovedBy() { return approvedBy; }
    public void setApprovedBy(UserAccount approvedBy) { this.approvedBy = approvedBy; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public UserAccount getPrintedBy() { return printedBy; }
    public void setPrintedBy(UserAccount printedBy) { this.printedBy = printedBy; }
    public Instant getPrintedAt() { return printedAt; }
    public void setPrintedAt(Instant printedAt) { this.printedAt = printedAt; }
    public int getDownloadCount() { return downloadCount; }
    public void setDownloadCount(int downloadCount) { this.downloadCount = downloadCount; }
    public int getPrintCount() { return printCount; }
    public void setPrintCount(int printCount) { this.printCount = printCount; }
    public Instant getLastDownloadedAt() { return lastDownloadedAt; }
    public void setLastDownloadedAt(Instant lastDownloadedAt) { this.lastDownloadedAt = lastDownloadedAt; }
    public UserAccount getDistributedBy() { return distributedBy; }
    public void setDistributedBy(UserAccount distributedBy) { this.distributedBy = distributedBy; }
    public Instant getDistributedAt() { return distributedAt; }
    public void setDistributedAt(Instant distributedAt) { this.distributedAt = distributedAt; }
    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    public String getDistributionComment() { return distributionComment; }
    public void setDistributionComment(String distributionComment) { this.distributionComment = distributionComment; }
    public String getRecipientSignature() { return recipientSignature; }
    public void setRecipientSignature(String recipientSignature) { this.recipientSignature = recipientSignature; }
    public LocalDate getRecipientDate() { return recipientDate; }
    public void setRecipientDate(LocalDate recipientDate) { this.recipientDate = recipientDate; }
    public UserAccount getRecipientUser() { return recipientUser; }
    public void setRecipientUser(UserAccount recipientUser) { this.recipientUser = recipientUser; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }

    public String getPreviewPasswordHash() { return previewPasswordHash; }
    public void setPreviewPasswordHash(String previewPasswordHash) { this.previewPasswordHash = previewPasswordHash; }
    public Instant getAccessTokenIssuedAt() { return accessTokenIssuedAt; }
    public void setAccessTokenIssuedAt(Instant accessTokenIssuedAt) { this.accessTokenIssuedAt = accessTokenIssuedAt; }
    public UserAccount getRecalledBy() { return recalledBy; }
    public void setRecalledBy(UserAccount recalledBy) { this.recalledBy = recalledBy; }
    public Instant getRecalledAt() { return recalledAt; }
    public void setRecalledAt(Instant recalledAt) { this.recalledAt = recalledAt; }
    public String getRecallReason() { return recallReason; }
    public void setRecallReason(String recallReason) { this.recallReason = recallReason; }
    public UserAccount getDestroyedBy() { return destroyedBy; }
    public void setDestroyedBy(UserAccount destroyedBy) { this.destroyedBy = destroyedBy; }
    public Instant getDestroyedAt() { return destroyedAt; }
    public void setDestroyedAt(Instant destroyedAt) { this.destroyedAt = destroyedAt; }
    public String getDestroyReason() { return destroyReason; }
    public void setDestroyReason(String destroyReason) { this.destroyReason = destroyReason; }
    public String getDestructionMethod() { return destructionMethod; }
    public void setDestructionMethod(String destructionMethod) { this.destructionMethod = destructionMethod; }
    public String getDestructionType() { return destructionType; }
    public void setDestructionType(String destructionType) { this.destructionType = destructionType; }
    public String getWitnessedBy() { return witnessedBy; }
    public void setWitnessedBy(String witnessedBy) { this.witnessedBy = witnessedBy; }
    public LocalDate getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDate validUntil) { this.validUntil = validUntil; }
    public LocalDate getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(LocalDate effectiveDate) { this.effectiveDate = effectiveDate; }
    public Boolean getHasExpiryDate() { return hasExpiryDate; }
    public void setHasExpiryDate(Boolean hasExpiryDate) { this.hasExpiryDate = hasExpiryDate; }
    public Instant getExpiryDate() { return expiryDate; }
    public void setExpiryDate(Instant expiryDate) { this.expiryDate = expiryDate; }
    public Boolean getExpiryAnchoredToDistribution() { return expiryAnchoredToDistribution; }
    public void setExpiryAnchoredToDistribution(Boolean expiryAnchoredToDistribution) { this.expiryAnchoredToDistribution = expiryAnchoredToDistribution; }
    public Instant getExpiryReminderSentAt() { return expiryReminderSentAt; }
    public void setExpiryReminderSentAt(Instant expiryReminderSentAt) { this.expiryReminderSentAt = expiryReminderSentAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public UserAccount getObsoletedBy() { return obsoletedBy; }
    public void setObsoletedBy(UserAccount obsoletedBy) { this.obsoletedBy = obsoletedBy; }
    public Instant getObsoletedAt() { return obsoletedAt; }
    public void setObsoletedAt(Instant obsoletedAt) { this.obsoletedAt = obsoletedAt; }

    public UserAccount getCancelledBy() { return cancelledBy; }
    public void setCancelledBy(UserAccount cancelledBy) { this.cancelledBy = cancelledBy; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }

    public ControlledCopyRecord getReplacedControlledCopy() { return replacedControlledCopy; }
    public void setReplacedControlledCopy(ControlledCopyRecord replacedControlledCopy) { this.replacedControlledCopy = replacedControlledCopy; }
}
