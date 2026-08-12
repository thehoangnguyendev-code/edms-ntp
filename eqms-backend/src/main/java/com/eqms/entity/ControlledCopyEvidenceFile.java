package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "controlled_copy_evidence_files")
public class ControlledCopyEvidenceFile {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "controlled_copy_id", nullable = false)
    private ControlledCopyRecord controlledCopy;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "stored_path", nullable = false, columnDefinition = "TEXT")
    private String storedPath;

    /** Original upload metadata. The original object is retained in MinIO for traceability. */
    @Column(name = "original_file_name", length = 255)
    private String originalFileName;

    @Column(name = "original_content_type", length = 120)
    private String originalContentType;

    @Column(name = "original_file_size")
    private Long originalFileSize;

    @Column(name = "original_stored_path", columnDefinition = "TEXT")
    private String originalStoredPath;

    @Column(name = "original_sha256", length = 64)
    private String originalSha256;

    @Column(name = "watermarked_sha256", length = 64)
    private String watermarkedSha256;

    @Column(name = "watermarked", nullable = false)
    private boolean watermarked;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_user_id")
    private UserAccount uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    @PrePersist
    void onCreate() {
        if (uploadedAt == null) {
            uploadedAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public ControlledCopyRecord getControlledCopy() { return controlledCopy; }
    public void setControlledCopy(ControlledCopyRecord controlledCopy) { this.controlledCopy = controlledCopy; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getStoredPath() { return storedPath; }
    public void setStoredPath(String storedPath) { this.storedPath = storedPath; }
    public String getOriginalFileName() { return originalFileName; }
    public void setOriginalFileName(String originalFileName) { this.originalFileName = originalFileName; }
    public String getOriginalContentType() { return originalContentType; }
    public void setOriginalContentType(String originalContentType) { this.originalContentType = originalContentType; }
    public Long getOriginalFileSize() { return originalFileSize; }
    public void setOriginalFileSize(Long originalFileSize) { this.originalFileSize = originalFileSize; }
    public String getOriginalStoredPath() { return originalStoredPath; }
    public void setOriginalStoredPath(String originalStoredPath) { this.originalStoredPath = originalStoredPath; }
    public String getOriginalSha256() { return originalSha256; }
    public void setOriginalSha256(String originalSha256) { this.originalSha256 = originalSha256; }
    public String getWatermarkedSha256() { return watermarkedSha256; }
    public void setWatermarkedSha256(String watermarkedSha256) { this.watermarkedSha256 = watermarkedSha256; }
    public boolean isWatermarked() { return watermarked; }
    public void setWatermarked(boolean watermarked) { this.watermarked = watermarked; }
    public UserAccount getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(UserAccount uploadedBy) { this.uploadedBy = uploadedBy; }
    public Instant getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(Instant uploadedAt) { this.uploadedAt = uploadedAt; }
}
