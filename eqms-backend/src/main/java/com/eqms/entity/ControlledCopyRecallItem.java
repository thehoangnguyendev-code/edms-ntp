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

import java.time.Instant;
import java.util.UUID;

/** One uploaded scan inside a {@link ControlledCopyRecallBatch}: the file, what was read from it, and what it matched. */
@Entity
@Table(name = "controlled_copy_recall_items")
public class ControlledCopyRecallItem {

    public static final String VIRUS_CLEAN = "CLEAN";
    public static final String VIRUS_INFECTED = "INFECTED";
    /** Malware scanning is disabled in this environment (local development only). */
    public static final String VIRUS_NOT_SCANNED = "NOT_SCANNED";

    public static final String QR_DECODED = "DECODED";
    public static final String QR_NOT_FOUND = "NOT_FOUND";
    /** A code was read but it is not an EQMS Controlled Copy code. */
    public static final String QR_FOREIGN = "FOREIGN";
    public static final String QR_MULTIPLE = "MULTIPLE";
    /** The file could not be opened as a PDF/image. */
    public static final String QR_UNREADABLE_FILE = "UNREADABLE_FILE";
    public static final String QR_NOT_ATTEMPTED = "NOT_ATTEMPTED";

    public static final String SOURCE_QR = "QR";
    public static final String SOURCE_MANUAL = "MANUAL";

    /** Matched and eligible for recall. */
    public static final String MATCH_READY = "READY";
    /** No copy identified yet; the DCO can match it by hand. */
    public static final String MATCH_UNMATCHED = "UNMATCHED";
    /** Identified, but cannot be recalled (state, duplicate, infected file...). The message says why. */
    public static final String MATCH_BLOCKED = "BLOCKED";

    public static final String OUTCOME_PENDING = "PENDING";
    public static final String OUTCOME_RECALLED = "RECALLED";
    public static final String OUTCOME_SKIPPED = "SKIPPED";

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false)
    private ControlledCopyRecallBatch batch;

    @Column(name = "item_no", nullable = false)
    private int itemNo;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(nullable = false, length = 64)
    private String sha256;

    /** Canonical reference FileStorageService.readFile expects; null when the file was rejected as infected. */
    @Column(name = "stored_path", columnDefinition = "TEXT")
    private String storedPath;

    @Column(name = "storage_provider", length = 60)
    private String storageProvider;

    @Column(name = "storage_bucket", length = 255)
    private String storageBucket;

    @Column(name = "storage_object_key", length = 1024)
    private String storageObjectKey;

    @Column(name = "storage_version_id", length = 255)
    private String storageVersionId;

    @Column(name = "virus_status", nullable = false, length = 20)
    private String virusStatus;

    @Column(name = "virus_signature", length = 255)
    private String virusSignature;

    @Column(name = "qr_status", nullable = false, length = 20)
    private String qrStatus = QR_NOT_ATTEMPTED;

    /** The raw text decoded from the code, kept for the audit trail. */
    @Column(name = "qr_value", columnDefinition = "TEXT")
    private String qrValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "controlled_copy_id")
    private ControlledCopyRecord controlledCopy;

    @Column(name = "match_source", length = 10)
    private String matchSource;

    @Column(name = "match_status", nullable = false, length = 20)
    private String matchStatus = MATCH_UNMATCHED;

    @Column(name = "match_message", length = 500)
    private String matchMessage;

    @Column(nullable = false)
    private boolean excluded;

    @Column(nullable = false, length = 20)
    private String outcome = OUTCOME_PENDING;

    @Column(name = "outcome_message", length = 500)
    private String outcomeMessage;

    /** The scan this item was cut from (when the upload held pages of several copies); kept untouched as evidence. */
    @Column(name = "source_file_name", length = 255)
    private String sourceFileName;

    @Column(name = "source_sha256", length = 64)
    private String sourceSha256;

    @Column(name = "source_stored_path", columnDefinition = "TEXT")
    private String sourceStoredPath;

    /** Which pages of the source went into this item, in the order they are in its file (for people to read). */
    @Column(name = "source_pages", length = 1000)
    private String sourcePages;

    /** The page numbers (within the copy) of the pages in this item, in file order, comma separated. Null for a whole-file item. */
    @Column(name = "page_numbers", length = 1000)
    private String pageNumbers;

    /** How many pages the copy has, as printed in its codes (or the page count of the copy itself). */
    @Column(name = "expected_pages")
    private Integer expectedPages;

    /** Why a page was not recognised (a page item only). */
    @Column(name = "page_note", length = 500)
    private String pageNote;

    @Column(name = "executed_record_id")
    private UUID executedRecordId;

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
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public ControlledCopyRecallBatch getBatch() { return batch; }
    public void setBatch(ControlledCopyRecallBatch batch) { this.batch = batch; }
    public int getItemNo() { return itemNo; }
    public void setItemNo(int itemNo) { this.itemNo = itemNo; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public String getStoredPath() { return storedPath; }
    public void setStoredPath(String storedPath) { this.storedPath = storedPath; }
    public String getStorageProvider() { return storageProvider; }
    public void setStorageProvider(String storageProvider) { this.storageProvider = storageProvider; }
    public String getStorageBucket() { return storageBucket; }
    public void setStorageBucket(String storageBucket) { this.storageBucket = storageBucket; }
    public String getStorageObjectKey() { return storageObjectKey; }
    public void setStorageObjectKey(String storageObjectKey) { this.storageObjectKey = storageObjectKey; }
    public String getStorageVersionId() { return storageVersionId; }
    public void setStorageVersionId(String storageVersionId) { this.storageVersionId = storageVersionId; }
    public String getVirusStatus() { return virusStatus; }
    public void setVirusStatus(String virusStatus) { this.virusStatus = virusStatus; }
    public String getVirusSignature() { return virusSignature; }
    public void setVirusSignature(String virusSignature) { this.virusSignature = virusSignature; }
    public String getQrStatus() { return qrStatus; }
    public void setQrStatus(String qrStatus) { this.qrStatus = qrStatus; }
    public String getQrValue() { return qrValue; }
    public void setQrValue(String qrValue) { this.qrValue = qrValue; }
    public String getSourceFileName() { return sourceFileName; }
    public void setSourceFileName(String v) { this.sourceFileName = v; }
    public String getSourceSha256() { return sourceSha256; }
    public void setSourceSha256(String v) { this.sourceSha256 = v; }
    public String getSourceStoredPath() { return sourceStoredPath; }
    public void setSourceStoredPath(String v) { this.sourceStoredPath = v; }
    public String getSourcePages() { return sourcePages; }
    public void setSourcePages(String v) { this.sourcePages = v; }
    public String getPageNumbers() { return pageNumbers; }
    public void setPageNumbers(String v) { this.pageNumbers = v; }
    public Integer getExpectedPages() { return expectedPages; }
    public void setExpectedPages(Integer v) { this.expectedPages = v; }
    public String getPageNote() { return pageNote; }
    public void setPageNote(String v) { this.pageNote = v; }
    public ControlledCopyRecord getControlledCopy() { return controlledCopy; }
    public void setControlledCopy(ControlledCopyRecord controlledCopy) { this.controlledCopy = controlledCopy; }
    public String getMatchSource() { return matchSource; }
    public void setMatchSource(String matchSource) { this.matchSource = matchSource; }
    public String getMatchStatus() { return matchStatus; }
    public void setMatchStatus(String matchStatus) { this.matchStatus = matchStatus; }
    public String getMatchMessage() { return matchMessage; }
    public void setMatchMessage(String matchMessage) { this.matchMessage = matchMessage; }
    public boolean isExcluded() { return excluded; }
    public void setExcluded(boolean excluded) { this.excluded = excluded; }
    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }
    public String getOutcomeMessage() { return outcomeMessage; }
    public void setOutcomeMessage(String outcomeMessage) { this.outcomeMessage = outcomeMessage; }
    public UUID getExecutedRecordId() { return executedRecordId; }
    public void setExecutedRecordId(UUID executedRecordId) { this.executedRecordId = executedRecordId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
