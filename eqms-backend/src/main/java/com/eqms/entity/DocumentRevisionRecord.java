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
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "document_revisions")
public class DocumentRevisionRecord {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_revision_id")
    private DocumentRevisionRecord parentRevision;

    @Column(name = "document_number", nullable = false, length = 80)
    private String documentNumber;

    @Column(name = "document_name", nullable = false, length = 255)
    private String documentName;

    @Column(name = "title_local_language", length = 255)
    private String titleLocalLanguage;

    @Column(name = "revision_name", nullable = false, length = 255)
    private String revisionName;

    @Column(name = "revision_number", nullable = false, length = 40)
    private String revisionNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "status_code", referencedColumnName = "code", nullable = false)
    private RevisionStatusDefinition status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_type_id", nullable = false)
    private DocumentType documentType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_unit_id", nullable = false)
    private BusinessUnit businessUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_user_id", nullable = false)
    private UserAccount author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private UserAccount owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by_user_id")
    private UserAccount openedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_modified_by_user_id")
    private UserAccount lastModifiedBy;

    @Column(length = 1024)
    private String description;

    @Column(name = "knowledge_base", length = 255)
    private String knowledgeBase;

    @Column(name = "is_template", nullable = false)
    private boolean template;

    @Column(name = "has_related_documents", nullable = false)
    private boolean hasRelatedDocuments;

    @Column(name = "has_correlated_documents", nullable = false)
    private boolean hasCorrelatedDocuments;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "periodic_review_cycle")
    private Integer periodicReviewCycle;

    @Column(name = "periodic_review_notification")
    private Integer periodicReviewNotification;

    @Column(name = "sub_type", length = 255)
    private String subType;

    /** Snapshot of the Sub-Type workflow rule; never recompute for an in-flight revision. */
    @Enumerated(EnumType.STRING)
    @Column(name = "review_requirement", nullable = false, length = 16)
    private ReviewRequirement reviewRequirement = ReviewRequirement.SINGLE;

    @Column(length = 100)
    private String language;

    @Column(name = "requires_training", nullable = false)
    private boolean requiresTraining;

    @Column(name = "training_period_days")
    private Integer trainingPeriodDays;

    @Column(name = "reason_for_skipping_training", length = 1024)
    private String reasonForSkippingTraining;

    @Column(name = "training_planned_date")
    private LocalDate trainingPlannedDate;

    @Column(name = "training_period_end_date")
    private LocalDate trainingPeriodEndDate;

    @Column(name = "training_completion_date")
    private LocalDate trainingCompletionDate;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "file_path", length = 1024)
    private String filePath;

    @Column(name = "preview_file_path", length = 1024)
    private String previewFilePath;

    @Column(name = "file_type", length = 120)
    private String fileType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "source_storage_provider", length = 60)
    private String sourceStorageProvider;

    @Column(name = "source_storage_bucket", length = 255)
    private String sourceStorageBucket;

    @Column(name = "source_storage_object_key", length = 1024)
    private String sourceStorageObjectKey;

    @Column(name = "source_storage_version_id", length = 255)
    private String sourceStorageVersionId;

    @Column(name = "source_file_checksum", length = 128)
    private String sourceFileChecksum;

    @Column(name = "source_uploaded_at")
    private Instant sourceUploadedAt;

    @Column(name = "editing_status", nullable = false, length = 30)
    private String editingStatus = "IN_PROGRESS";

    @Column(name = "source_locked", nullable = false)
    private boolean sourceLocked = false;

    @Column(name = "completed_by_user_id")
    private UUID completedByUserId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "snapshot_status", length = 30)
    private String snapshotStatus;

    @Column(name = "snapshot_error")
    private String snapshotError;

    @Column(name = "snapshot_request_id")
    private UUID snapshotRequestId;

    @Column(name = "snapshot_source_checksum", length = 128)
    private String snapshotSourceChecksum;

    @Column(name = "storage_provider", length = 60)
    private String storageProvider;

    @Column(name = "storage_site_id", length = 255)
    private String storageSiteId;

    @Column(name = "storage_drive_id", length = 255)
    private String storageDriveId;

    @Column(name = "storage_item_id", length = 255)
    private String storageItemId;

    @Column(name = "storage_web_url", length = 1024)
    private String storageWebUrl;

    @Column(name = "storage_edit_url", length = 1024)
    private String storageEditUrl;

    @Column(name = "storage_edit_permission_id", length = 255)
    private String storageEditPermissionId;

    @Column(name = "storage_view_url", length = 1024)
    private String storageViewUrl;

    @Column(name = "storage_view_permission_id", length = 255)
    private String storageViewPermissionId;

    @Column(name = "storage_pdf_url", length = 1024)
    private String storagePdfUrl;

    @Column(name = "storage_sync_status", length = 40)
    private String storageSyncStatus;

    @Column(name = "storage_last_synced_at")
    private Instant storageLastSyncedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_by_user_id")
    private UserAccount publishedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by_user_id")
    private UserAccount submittedBy;

    @Column(name = "submitted_on")
    private Instant submittedOn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rejected_by_user_id")
    private UserAccount rejectedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

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

    @Column(name = "impact_analysis_id")
    private UUID impactAnalysisId;

    @PrePersist
    void onCreate() {
        syncRevisionName();
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
        syncRevisionName();
        updatedAt = Instant.now();
    }

    private void syncRevisionName() {
        String sourceTitle = document == null ? null : document.getDocumentName();
        if (sourceTitle == null) {
            sourceTitle = documentName;
        }
        if (sourceTitle == null) {
            return;
        }
        String safeTitle = sourceTitle.trim();
        String safeVersion = revisionNumber == null ? "0.0.1" : revisionNumber.trim();
        if (safeTitle.isEmpty()) {
            revisionName = safeVersion;
            return;
        }
        revisionName = safeTitle + "_" + safeVersion;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public DocumentRecord getDocument() {
        return document;
    }

    public void setDocument(DocumentRecord document) {
        this.document = document;
    }

    public DocumentRevisionRecord getParentRevision() {
        return parentRevision;
    }

    public void setParentRevision(DocumentRevisionRecord parentRevision) {
        this.parentRevision = parentRevision;
    }

    public String getDocumentNumber() {
        return documentNumber;
    }

    public void setDocumentNumber(String documentNumber) {
        this.documentNumber = documentNumber;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
    }

    public String getTitleLocalLanguage() {
        return titleLocalLanguage;
    }

    public void setTitleLocalLanguage(String titleLocalLanguage) {
        this.titleLocalLanguage = titleLocalLanguage;
    }

    public String getRevisionName() {
        return revisionName;
    }

    public void setRevisionName(String revisionName) {
        this.revisionName = revisionName;
    }

    public String getRevisionNumber() {
        return revisionNumber;
    }

    public void setRevisionNumber(String revisionNumber) {
        this.revisionNumber = revisionNumber;
    }

    public RevisionStatusDefinition getStatus() {
        return status;
    }

    public void setStatus(RevisionStatusDefinition status) {
        this.status = status;
    }

    public DocumentType getDocumentType() {
        return documentType;
    }

    public void setDocumentType(DocumentType documentType) {
        this.documentType = documentType;
    }

    public BusinessUnit getBusinessUnit() {
        return businessUnit;
    }

    public void setBusinessUnit(BusinessUnit businessUnit) {
        this.businessUnit = businessUnit;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(Department department) {
        this.department = department;
    }

    public UserAccount getAuthor() {
        return author;
    }

    public void setAuthor(UserAccount author) {
        this.author = author;
    }

    public UserAccount getOwner() {
        return owner;
    }

    public void setOwner(UserAccount owner) {
        this.owner = owner;
    }

    public UserAccount getOpenedBy() {
        return openedBy;
    }

    public void setOpenedBy(UserAccount openedBy) {
        this.openedBy = openedBy;
    }

    public UserAccount getLastModifiedBy() {
        return lastModifiedBy;
    }

    public void setLastModifiedBy(UserAccount lastModifiedBy) {
        this.lastModifiedBy = lastModifiedBy;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getKnowledgeBase() {
        return knowledgeBase;
    }

    public void setKnowledgeBase(String knowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    public boolean isTemplate() {
        return template;
    }

    public void setTemplate(boolean template) {
        this.template = template;
    }

    public boolean isHasRelatedDocuments() {
        return hasRelatedDocuments;
    }

    public void setHasRelatedDocuments(boolean hasRelatedDocuments) {
        this.hasRelatedDocuments = hasRelatedDocuments;
    }

    public boolean isHasCorrelatedDocuments() {
        return hasCorrelatedDocuments;
    }

    public void setHasCorrelatedDocuments(boolean hasCorrelatedDocuments) {
        this.hasCorrelatedDocuments = hasCorrelatedDocuments;
    }

    public LocalDate getEffectiveDate() {
        return effectiveDate;
    }

    public void setEffectiveDate(LocalDate effectiveDate) {
        this.effectiveDate = effectiveDate;
    }

    public LocalDate getValidUntil() {
        return validUntil;
    }

    public void setValidUntil(LocalDate validUntil) {
        this.validUntil = validUntil;
    }

    public Integer getPeriodicReviewCycle() {
        return periodicReviewCycle;
    }

    public void setPeriodicReviewCycle(Integer periodicReviewCycle) {
        this.periodicReviewCycle = periodicReviewCycle;
    }

    public Integer getPeriodicReviewNotification() {
        return periodicReviewNotification;
    }

    public void setPeriodicReviewNotification(Integer periodicReviewNotification) {
        this.periodicReviewNotification = periodicReviewNotification;
    }

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }

    public ReviewRequirement getReviewRequirement() {
        return reviewRequirement == null ? ReviewRequirement.SINGLE : reviewRequirement;
    }

    public void setReviewRequirement(ReviewRequirement reviewRequirement) {
        this.reviewRequirement = reviewRequirement == null ? ReviewRequirement.SINGLE : reviewRequirement;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public boolean isRequiresTraining() {
        return requiresTraining;
    }

    public void setRequiresTraining(boolean requiresTraining) {
        this.requiresTraining = requiresTraining;
    }

    public Integer getTrainingPeriodDays() {
        return trainingPeriodDays;
    }

    public void setTrainingPeriodDays(Integer trainingPeriodDays) {
        this.trainingPeriodDays = trainingPeriodDays;
    }

    public String getReasonForSkippingTraining() {
        return reasonForSkippingTraining;
    }

    public void setReasonForSkippingTraining(String reasonForSkippingTraining) {
        this.reasonForSkippingTraining = reasonForSkippingTraining;
    }

    public LocalDate getTrainingPlannedDate() {
        return trainingPlannedDate;
    }

    public void setTrainingPlannedDate(LocalDate trainingPlannedDate) {
        this.trainingPlannedDate = trainingPlannedDate;
    }

    public LocalDate getTrainingPeriodEndDate() {
        return trainingPeriodEndDate;
    }

    public void setTrainingPeriodEndDate(LocalDate trainingPeriodEndDate) {
        this.trainingPeriodEndDate = trainingPeriodEndDate;
    }

    public LocalDate getTrainingCompletionDate() {
        return trainingCompletionDate;
    }

    public void setTrainingCompletionDate(LocalDate trainingCompletionDate) {
        this.trainingCompletionDate = trainingCompletionDate;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getPreviewFilePath() {
        return previewFilePath;
    }

    public void setPreviewFilePath(String previewFilePath) {
        this.previewFilePath = previewFilePath;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getSourceStorageProvider() {
        return sourceStorageProvider;
    }

    public void setSourceStorageProvider(String sourceStorageProvider) {
        this.sourceStorageProvider = sourceStorageProvider;
    }

    public String getSourceStorageBucket() {
        return sourceStorageBucket;
    }

    public void setSourceStorageBucket(String sourceStorageBucket) {
        this.sourceStorageBucket = sourceStorageBucket;
    }

    public String getSourceStorageObjectKey() {
        return sourceStorageObjectKey;
    }

    public void setSourceStorageObjectKey(String sourceStorageObjectKey) {
        this.sourceStorageObjectKey = sourceStorageObjectKey;
    }

    public String getSourceStorageVersionId() {
        return sourceStorageVersionId;
    }

    public void setSourceStorageVersionId(String sourceStorageVersionId) {
        this.sourceStorageVersionId = sourceStorageVersionId;
    }

    public String getSourceFileChecksum() {
        return sourceFileChecksum;
    }

    public void setSourceFileChecksum(String sourceFileChecksum) {
        this.sourceFileChecksum = sourceFileChecksum;
    }

    public Instant getSourceUploadedAt() {
        return sourceUploadedAt;
    }

    public void setSourceUploadedAt(Instant sourceUploadedAt) {
        this.sourceUploadedAt = sourceUploadedAt;
    }

    public String getEditingStatus() {
        return editingStatus;
    }

    public void setEditingStatus(String editingStatus) {
        this.editingStatus = editingStatus;
    }

    public boolean isSourceLocked() {
        return sourceLocked;
    }

    public void setSourceLocked(boolean sourceLocked) {
        this.sourceLocked = sourceLocked;
    }

    public UUID getCompletedByUserId() {
        return completedByUserId;
    }

    public void setCompletedByUserId(UUID completedByUserId) {
        this.completedByUserId = completedByUserId;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getSnapshotStatus() {
        return snapshotStatus;
    }

    public void setSnapshotStatus(String snapshotStatus) {
        this.snapshotStatus = snapshotStatus;
    }

    public String getSnapshotError() {
        return snapshotError;
    }

    public void setSnapshotError(String snapshotError) {
        this.snapshotError = snapshotError;
    }

    public UUID getSnapshotRequestId() {
        return snapshotRequestId;
    }

    public void setSnapshotRequestId(UUID snapshotRequestId) {
        this.snapshotRequestId = snapshotRequestId;
    }

    public String getSnapshotSourceChecksum() {
        return snapshotSourceChecksum;
    }

    public void setSnapshotSourceChecksum(String snapshotSourceChecksum) {
        this.snapshotSourceChecksum = snapshotSourceChecksum;
    }

    public String getStorageProvider() {
        return storageProvider;
    }

    public void setStorageProvider(String storageProvider) {
        this.storageProvider = storageProvider;
    }

    public String getStorageSiteId() {
        return storageSiteId;
    }

    public void setStorageSiteId(String storageSiteId) {
        this.storageSiteId = storageSiteId;
    }

    public String getStorageDriveId() {
        return storageDriveId;
    }

    public void setStorageDriveId(String storageDriveId) {
        this.storageDriveId = storageDriveId;
    }

    public String getStorageItemId() {
        return storageItemId;
    }

    public void setStorageItemId(String storageItemId) {
        this.storageItemId = storageItemId;
    }

    public String getStorageWebUrl() {
        return storageWebUrl;
    }

    public void setStorageWebUrl(String storageWebUrl) {
        this.storageWebUrl = storageWebUrl;
    }

    public String getStorageEditUrl() {
        return storageEditUrl;
    }

    public void setStorageEditUrl(String storageEditUrl) {
        this.storageEditUrl = storageEditUrl;
    }

    public String getStorageEditPermissionId() {
        return storageEditPermissionId;
    }

    public void setStorageEditPermissionId(String storageEditPermissionId) {
        this.storageEditPermissionId = storageEditPermissionId;
    }

    public String getStorageViewUrl() {
        return storageViewUrl;
    }

    public void setStorageViewUrl(String storageViewUrl) {
        this.storageViewUrl = storageViewUrl;
    }

    public String getStorageViewPermissionId() {
        return storageViewPermissionId;
    }

    public void setStorageViewPermissionId(String storageViewPermissionId) {
        this.storageViewPermissionId = storageViewPermissionId;
    }

    public String getStoragePdfUrl() {
        return storagePdfUrl;
    }

    public void setStoragePdfUrl(String storagePdfUrl) {
        this.storagePdfUrl = storagePdfUrl;
    }

    public String getStorageSyncStatus() {
        return storageSyncStatus;
    }

    public void setStorageSyncStatus(String storageSyncStatus) {
        this.storageSyncStatus = storageSyncStatus;
    }

    public Instant getStorageLastSyncedAt() {
        return storageLastSyncedAt;
    }

    public void setStorageLastSyncedAt(Instant storageLastSyncedAt) {
        this.storageLastSyncedAt = storageLastSyncedAt;
    }

    public UserAccount getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(UserAccount publishedBy) {
        this.publishedBy = publishedBy;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public UserAccount getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(UserAccount submittedBy) {
        this.submittedBy = submittedBy;
    }

    public Instant getSubmittedOn() {
        return submittedOn;
    }

    public void setSubmittedOn(Instant submittedOn) {
        this.submittedOn = submittedOn;
    }

    public UserAccount getRejectedBy() {
        return rejectedBy;
    }

    public void setRejectedBy(UserAccount rejectedBy) {
        this.rejectedBy = rejectedBy;
    }

    public Instant getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(Instant rejectedAt) {
        this.rejectedAt = rejectedAt;
    }

    public UserAccount getObsoletedBy() {
        return obsoletedBy;
    }

    public void setObsoletedBy(UserAccount obsoletedBy) {
        this.obsoletedBy = obsoletedBy;
    }

    public Instant getObsoletedAt() {
        return obsoletedAt;
    }

    public void setObsoletedAt(Instant obsoletedAt) {
        this.obsoletedAt = obsoletedAt;
    }

    public UserAccount getCancelledBy() {
        return cancelledBy;
    }

    public void setCancelledBy(UserAccount cancelledBy) {
        this.cancelledBy = cancelledBy;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(Instant cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public UUID getImpactAnalysisId() {
        return impactAnalysisId;
    }

    public void setImpactAnalysisId(UUID impactAnalysisId) {
        this.impactAnalysisId = impactAnalysisId;
    }
}
