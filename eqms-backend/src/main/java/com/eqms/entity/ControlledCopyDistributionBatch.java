package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "controlled_copy_distribution_batches")
public class ControlledCopyDistributionBatch {

    @Id
    private UUID id;

    @Column(name = "batch_number", nullable = false, length = 120)
    private String batchNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revision_id", nullable = false)
    private DocumentRevisionRecord revision;

    @Column(name = "document_number", nullable = false, length = 100)
    private String documentNumber;

    @Column(name = "document_title", length = 500)
    private String documentTitle;

    @Column(name = "revision_number", length = 50)
    private String revisionNumber;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "status", nullable = false, length = 40)
    private String status;

    @Column(name = "status_code", nullable = false, length = 40)
    private String statusCode;

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

    @Column(name = "has_expiry_date", nullable = false)
    private Boolean hasExpiryDate = false;

    @Column(name = "expiry_date")
    private Instant expiryDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private UserAccount requestedBy;

    @Column(name = "requested_at")
    private Instant requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "distributed_by_user_id")
    private UserAccount distributedBy;

    @Column(name = "distributed_at")
    private Instant distributedAt;

    @Column(name = "distribution_comment", columnDefinition = "TEXT")
    private String distributionComment;

    @Column(name = "recall_date")
    private Instant recallDate;

    @Column(name = "recall_reason", columnDefinition = "TEXT")
    private String recallReason;

    @OneToMany(mappedBy = "distributionBatch", fetch = FetchType.LAZY)
    private List<ControlledCopyRecord> copies = new ArrayList<>();

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
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }
    public DocumentRecord getDocument() { return document; }
    public void setDocument(DocumentRecord document) { this.document = document; }
    public DocumentRevisionRecord getRevision() { return revision; }
    public void setRevision(DocumentRevisionRecord revision) { this.revision = revision; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }
    public String getRevisionNumber() { return revisionNumber; }
    public void setRevisionNumber(String revisionNumber) { this.revisionNumber = revisionNumber; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusCode() { return statusCode; }
    public void setStatusCode(String statusCode) { this.statusCode = statusCode; }
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
    public Boolean getHasExpiryDate() { return hasExpiryDate; }
    public void setHasExpiryDate(Boolean hasExpiryDate) { this.hasExpiryDate = hasExpiryDate; }
    public Instant getExpiryDate() { return expiryDate; }
    public void setExpiryDate(Instant expiryDate) { this.expiryDate = expiryDate; }
    public UserAccount getRequestedBy() { return requestedBy; }
    public void setRequestedBy(UserAccount requestedBy) { this.requestedBy = requestedBy; }
    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
    public UserAccount getDistributedBy() { return distributedBy; }
    public void setDistributedBy(UserAccount distributedBy) { this.distributedBy = distributedBy; }
    public Instant getDistributedAt() { return distributedAt; }
    public void setDistributedAt(Instant distributedAt) { this.distributedAt = distributedAt; }
    public String getDistributionComment() { return distributionComment; }
    public void setDistributionComment(String distributionComment) { this.distributionComment = distributionComment; }
    public Instant getRecallDate() { return recallDate; }
    public void setRecallDate(Instant recallDate) { this.recallDate = recallDate; }
    public String getRecallReason() { return recallReason; }
    public void setRecallReason(String recallReason) { this.recallReason = recallReason; }
    public List<ControlledCopyRecord> getCopies() { return copies; }
    public void setCopies(List<ControlledCopyRecord> copies) { this.copies = copies; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
