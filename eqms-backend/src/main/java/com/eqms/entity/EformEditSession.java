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
 * Transient working state for a live OnlyOffice session against a Form: either an Author
 * designing fillable fields on the Form's PDF (DESIGN) or an end user filling them in-browser
 * (FILL). See {@code EformEditSessionService}. Committing a DESIGN session copies its latest saved
 * file into {@link FormSettings}' fillable-template columns; submitting a FILL session feeds
 * {@code ExecutedRecordService.finalizeSubmission} unchanged.
 */
@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "eform_edit_sessions")
public class EformEditSession {

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(nullable = false, length = 10)
    private String kind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "form_document_id", nullable = false)
    private DocumentRecord formDocument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "started_by_user_id", nullable = false)
    private UserAccount startedBy;

    @Column(nullable = false, length = 20)
    private String status;

    /** Carries the real extension (.docx for a Design session's DOCX-content-control-based form,
     *  never assumed to be .pdf) -- OnlyOffice's Forms ribbon for adding NEW fields only appears
     *  reliably for a DOCX-family file opened as documentType="word". */
    @Column(name = "file_name", length = 255)
    private String fileName;

    /** For a FILL session only -- the OnlyOffice Form Role this session was authorized to fill (see
     *  {@code FormRoleAssignmentService}). Null means the Form has no roles configured yet. */
    @Column(name = "assigned_role", length = 100)
    private String assignedRole;

    /** For a FILL session only, when the Form has sequential signer roles configured -- the
     *  {@link EformFillRun} this session is one step of. Null for a Form with no roles. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fill_run_id")
    private EformFillRun fillRun;

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

    @Column(name = "save_version", nullable = false)
    private int saveVersion;

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
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public DocumentRecord getFormDocument() { return formDocument; }
    public void setFormDocument(DocumentRecord formDocument) { this.formDocument = formDocument; }
    public UserAccount getStartedBy() { return startedBy; }
    public void setStartedBy(UserAccount startedBy) { this.startedBy = startedBy; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getAssignedRole() { return assignedRole; }
    public void setAssignedRole(String assignedRole) { this.assignedRole = assignedRole; }
    public EformFillRun getFillRun() { return fillRun; }
    public void setFillRun(EformFillRun fillRun) { this.fillRun = fillRun; }
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
    public int getSaveVersion() { return saveVersion; }
    public void setSaveVersion(int saveVersion) { this.saveVersion = saveVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
