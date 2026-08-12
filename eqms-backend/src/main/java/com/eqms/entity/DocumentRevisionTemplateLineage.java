package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable provenance for a revision created from a controlled-document template.
 * Database triggers protect this record after insert; it must never be repurposed when
 * either the template or target document subsequently changes lifecycle state.
 */
@Entity
@Table(name = "document_revision_template_lineage")
public class DocumentRevisionTemplateLineage {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_revision_id", nullable = false, unique = true)
    private DocumentRevisionRecord targetRevision;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_template_document_id", nullable = false)
    private DocumentRecord sourceTemplateDocument;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_template_revision_id", nullable = false)
    private DocumentRevisionRecord sourceTemplateRevision;

    @Column(name = "source_template_revision_number", nullable = false, length = 80)
    private String sourceTemplateRevisionNumber;

    @Column(name = "source_file_checksum", nullable = false, length = 128)
    private String sourceFileChecksum;

    @Column(name = "source_storage_provider", length = 80)
    private String sourceStorageProvider;

    @Column(name = "source_storage_bucket", length = 255)
    private String sourceStorageBucket;

    @Column(name = "source_storage_object_key", length = 1024)
    private String sourceStorageObjectKey;

    @Column(name = "source_storage_version_id", length = 512)
    private String sourceStorageVersionId;

    @Column(name = "target_file_checksum", nullable = false, length = 128)
    private String targetFileChecksum;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "selected_by_user_id", nullable = false)
    private UserAccount selectedBy;

    @Column(name = "selected_at", nullable = false)
    private Instant selectedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "placeholder_snapshot", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> placeholderSnapshot = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prepareInsert() {
        if (id == null) id = UUID.randomUUID();
        Instant now = Instant.now();
        if (selectedAt == null) selectedAt = now;
        if (createdAt == null) createdAt = now;
    }

    public UUID getId() { return id; }
    public DocumentRevisionRecord getTargetRevision() { return targetRevision; }
    public void setTargetRevision(DocumentRevisionRecord value) { targetRevision = value; }
    public DocumentRecord getSourceTemplateDocument() { return sourceTemplateDocument; }
    public void setSourceTemplateDocument(DocumentRecord value) { sourceTemplateDocument = value; }
    public DocumentRevisionRecord getSourceTemplateRevision() { return sourceTemplateRevision; }
    public void setSourceTemplateRevision(DocumentRevisionRecord value) { sourceTemplateRevision = value; }
    public String getSourceTemplateRevisionNumber() { return sourceTemplateRevisionNumber; }
    public void setSourceTemplateRevisionNumber(String value) { sourceTemplateRevisionNumber = value; }
    public String getSourceFileChecksum() { return sourceFileChecksum; }
    public void setSourceFileChecksum(String value) { sourceFileChecksum = value; }
    public String getSourceStorageProvider() { return sourceStorageProvider; }
    public void setSourceStorageProvider(String value) { sourceStorageProvider = value; }
    public String getSourceStorageBucket() { return sourceStorageBucket; }
    public void setSourceStorageBucket(String value) { sourceStorageBucket = value; }
    public String getSourceStorageObjectKey() { return sourceStorageObjectKey; }
    public void setSourceStorageObjectKey(String value) { sourceStorageObjectKey = value; }
    public String getSourceStorageVersionId() { return sourceStorageVersionId; }
    public void setSourceStorageVersionId(String value) { sourceStorageVersionId = value; }
    public String getTargetFileChecksum() { return targetFileChecksum; }
    public void setTargetFileChecksum(String value) { targetFileChecksum = value; }
    public UserAccount getSelectedBy() { return selectedBy; }
    public void setSelectedBy(UserAccount value) { selectedBy = value; }
    public Instant getSelectedAt() { return selectedAt; }
    public void setSelectedAt(Instant value) { selectedAt = value; }
    public Map<String, Object> getPlaceholderSnapshot() { return placeholderSnapshot; }
    public void setPlaceholderSnapshot(Map<String, Object> value) { placeholderSnapshot = value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value); }
    public Instant getCreatedAt() { return createdAt; }
}
