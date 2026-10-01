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
 * One accumulating "in-progress Fill" for a Form that has sequential signer Roles configured
 * (see {@link FormRoleAssignment}) -- at most one IN_PROGRESS run per Form at a time. Each role's
 * {@link EformEditSession} (kind FILL) chains onto this run's latest saved file instead of
 * restarting from the Form's pristine fillable template, and only once the LAST role in sequence
 * signs off does {@code ExecutedRecordService#submitEformFromFillRun} turn it into a real
 * {@link ExecutedRecord}. A Form with no roles configured never creates one of these -- a single
 * FILL session still fills everything in one step (see {@code EformEditSessionService}).
 */
@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "eform_fill_runs")
public class EformFillRun {

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "form_document_id", nullable = false)
    private DocumentRecord formDocument;

    /** The electronic Controlled Copy this run belongs to -- lets multiple concurrent electronic
     *  distributions of the SAME Form each get an independent signer chain instead of colliding on
     *  one "active run per Form". */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "controlled_copy_id")
    private ControlledCopyRecord controlledCopy;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "current_sequence", nullable = false)
    private int currentSequence;

    @Column(name = "file_name", length = 255)
    private String fileName;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "started_by_user_id", nullable = false)
    private UserAccount startedBy;

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
    public DocumentRecord getFormDocument() { return formDocument; }
    public void setFormDocument(DocumentRecord formDocument) { this.formDocument = formDocument; }
    public ControlledCopyRecord getControlledCopy() { return controlledCopy; }
    public void setControlledCopy(ControlledCopyRecord controlledCopy) { this.controlledCopy = controlledCopy; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getCurrentSequence() { return currentSequence; }
    public void setCurrentSequence(int currentSequence) { this.currentSequence = currentSequence; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
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
    public UserAccount getStartedBy() { return startedBy; }
    public void setStartedBy(UserAccount startedBy) { this.startedBy = startedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
