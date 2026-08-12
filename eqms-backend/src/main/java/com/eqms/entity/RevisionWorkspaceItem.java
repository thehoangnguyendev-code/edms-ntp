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

@Entity
@Table(name = "revision_workspace_items")
public class RevisionWorkspaceItem {

    @Id
    private UUID id;

    @Column(name = "workspace_key", nullable = false, length = 120)
    private String workspaceKey;

    @Column(name = "item_order", nullable = false)
    private Integer itemOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_document_id")
    private DocumentRecord sourceDocument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_revision_id")
    private DocumentRevisionRecord sourceRevision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_revision_id")
    private DocumentRevisionRecord targetRevision;

    @Column(name = "workspace_mode", nullable = false, length = 20)
    private String workspaceMode;

    @Column(length = 20)
    private String decision;

    @Column(name = "item_status", nullable = false, length = 40)
    private String itemStatus;

    @Column(name = "revision_status", length = 40)
    private String revisionStatus;

    @Column(name = "document_number", length = 80)
    private String documentNumber;

    @Column(name = "document_name", length = 255)
    private String documentName;

    @Column(name = "revision_number", length = 40)
    private String revisionNumber;

    @Column(name = "next_revision_number", length = 40)
    private String nextRevisionNumber;

    @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
    private String payloadJson;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "file_path", length = 1024)
    private String filePath;

    @Column(name = "preview_file_path", length = 1024)
    private String previewFilePath;

    @Column(name = "error_message")
    private String errorMessage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private UserAccount createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private UserAccount updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getWorkspaceKey() { return workspaceKey; }
    public void setWorkspaceKey(String workspaceKey) { this.workspaceKey = workspaceKey; }
    public Integer getItemOrder() { return itemOrder; }
    public void setItemOrder(Integer itemOrder) { this.itemOrder = itemOrder; }
    public DocumentRecord getDocument() { return document; }
    public void setDocument(DocumentRecord document) { this.document = document; }
    public DocumentRecord getSourceDocument() { return sourceDocument; }
    public void setSourceDocument(DocumentRecord sourceDocument) { this.sourceDocument = sourceDocument; }
    public DocumentRevisionRecord getSourceRevision() { return sourceRevision; }
    public void setSourceRevision(DocumentRevisionRecord sourceRevision) { this.sourceRevision = sourceRevision; }
    public DocumentRevisionRecord getTargetRevision() { return targetRevision; }
    public void setTargetRevision(DocumentRevisionRecord targetRevision) { this.targetRevision = targetRevision; }
    public String getWorkspaceMode() { return workspaceMode; }
    public void setWorkspaceMode(String workspaceMode) { this.workspaceMode = workspaceMode; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getItemStatus() { return itemStatus; }
    public void setItemStatus(String itemStatus) { this.itemStatus = itemStatus; }
    public String getRevisionStatus() { return revisionStatus; }
    public void setRevisionStatus(String revisionStatus) { this.revisionStatus = revisionStatus; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getDocumentName() { return documentName; }
    public void setDocumentName(String documentName) { this.documentName = documentName; }
    public String getRevisionNumber() { return revisionNumber; }
    public void setRevisionNumber(String revisionNumber) { this.revisionNumber = revisionNumber; }
    public String getNextRevisionNumber() { return nextRevisionNumber; }
    public void setNextRevisionNumber(String nextRevisionNumber) { this.nextRevisionNumber = nextRevisionNumber; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public String getPreviewFilePath() { return previewFilePath; }
    public void setPreviewFilePath(String previewFilePath) { this.previewFilePath = previewFilePath; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public UserAccount getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserAccount createdBy) { this.createdBy = createdBy; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UserAccount updatedBy) { this.updatedBy = updatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
