package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per review-snapshot PDF write. Every regeneration writes to the same MinIO object key
 * for the revision's lifetime, so this table is what lets a specific review round's exact
 * snapshot be found again later — the MinIO object itself is versioned (bucket versioning +
 * Object Lock retention), this just remembers which version_id belongs to which round.
 */
@Entity
@Table(name = "revision_snapshot_history")
public class RevisionSnapshotHistory {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "revision_id", nullable = false)
    private DocumentRevisionRecord revision;

    @Column(name = "review_round", nullable = false)
    private int reviewRound;

    @Column(name = "object_key", nullable = false, length = 500)
    private String objectKey;

    @Column(name = "version_id")
    private String versionId;

    @Column(name = "checksum", length = 128)
    private String checksum;

    /** Checksum of the locked source used to produce this snapshot. */
    @Column(name = "source_checksum", length = 128)
    private String sourceChecksum;

    /** Correlates this immutable snapshot to its asynchronous generation request. */
    @Column(name = "generation_request_id")
    private UUID generationRequestId;

    @Column(name = "trigger_action", nullable = false, length = 50)
    private String triggerAction;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_by_user_id")
    private UserAccount generatedBy;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public DocumentRevisionRecord getRevision() { return revision; }
    public void setRevision(DocumentRevisionRecord revision) { this.revision = revision; }
    public int getReviewRound() { return reviewRound; }
    public void setReviewRound(int reviewRound) { this.reviewRound = reviewRound; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public String getVersionId() { return versionId; }
    public void setVersionId(String versionId) { this.versionId = versionId; }
    public String getChecksum() { return checksum; }
    public void setChecksum(String checksum) { this.checksum = checksum; }
    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }
    public UUID getGenerationRequestId() { return generationRequestId; }
    public void setGenerationRequestId(UUID generationRequestId) { this.generationRequestId = generationRequestId; }
    public String getTriggerAction() { return triggerAction; }
    public void setTriggerAction(String triggerAction) { this.triggerAction = triggerAction; }
    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant generatedAt) { this.generatedAt = generatedAt; }
    public UserAccount getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(UserAccount generatedBy) { this.generatedBy = generatedBy; }
}
