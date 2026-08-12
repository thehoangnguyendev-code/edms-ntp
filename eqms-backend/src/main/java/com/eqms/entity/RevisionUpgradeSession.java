package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "revision_upgrade_sessions")
public class RevisionUpgradeSession {

    @Id
    private UUID id;

    @Column(name = "session_key", nullable = false, unique = true, length = 120)
    private String sessionKey;

    @ManyToOne
    @JoinColumn(name = "source_document_id", nullable = false)
    private DocumentRecord sourceDocument;

    @ManyToOne
    @JoinColumn(name = "source_revision_id", nullable = false)
    private DocumentRevisionRecord sourceRevision;

    @Column(name = "workspace_mode", nullable = false, length = 20)
    private String workspaceMode = "upgrade";

    @Column(name = "status", nullable = false, length = 40)
    private String status = "DRAFT";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
    private String payloadJson;

    @ManyToOne
    @JoinColumn(name = "created_by_user_id")
    private UserAccount createdBy;

    @ManyToOne
    @JoinColumn(name = "updated_by_user_id")
    private UserAccount updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getSessionKey() {
        return sessionKey;
    }

    public void setSessionKey(String sessionKey) {
        this.sessionKey = sessionKey;
    }

    public DocumentRecord getSourceDocument() {
        return sourceDocument;
    }

    public void setSourceDocument(DocumentRecord sourceDocument) {
        this.sourceDocument = sourceDocument;
    }

    public DocumentRevisionRecord getSourceRevision() {
        return sourceRevision;
    }

    public void setSourceRevision(DocumentRevisionRecord sourceRevision) {
        this.sourceRevision = sourceRevision;
    }

    public String getWorkspaceMode() {
        return workspaceMode;
    }

    public void setWorkspaceMode(String workspaceMode) {
        this.workspaceMode = workspaceMode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public UserAccount getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UserAccount createdBy) {
        this.createdBy = createdBy;
    }

    public UserAccount getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(UserAccount updatedBy) {
        this.updatedBy = updatedBy;
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
}
