package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "electronic_signatures")
public class ElectronicSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revision_id")
    private DocumentRevisionRecord revision;

    @Column(name = "entity_type", length = 80)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "workflow_step_id")
    private UUID workflowStepId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(nullable = false, length = 120)
    private String username;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Column(name = "position", length = 120)
    private String position;

    @Column(length = 255)
    private String email;

    @Column(length = 120)
    private String department;

    @Column(nullable = false, length = 80)
    private String meaning;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "signed_at", nullable = false)
    private Instant signedAt;

    @Column(nullable = false, length = 80)
    private String timezone;

    @Column(name = "timestamp_display", length = 120)
    private String timestampDisplay;

    @Column(name = "authentication_method", nullable = false, length = 40)
    private String authenticationMethod;

    @Column(name = "signature_id", nullable = false, unique = true, length = 40)
    private String signatureId;

    @Column(name = "verification_id", nullable = false, unique = true, length = 80)
    private String verificationId;

    @Column(name = "ip_address", length = 80)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "document_checksum_before_sign", length = 255)
    private String documentChecksumBeforeSign;

    @Column(name = "document_checksum_after_sign", length = 255)
    private String documentChecksumAfterSign;

    @Column(name = "source_file_version_id", length = 255)
    private String sourceFileVersionId;

    @Column(name = "review_pdf_version_id", length = 255)
    private String reviewPdfVersionId;

    @Column(name = "published_pdf_version_id", length = 255)
    private String publishedPdfVersionId;

    @Column(nullable = false, length = 40)
    private String status = "SIGNED";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (signedAt == null) signedAt = now;
        if (createdAt == null) createdAt = now;
        if (status == null || status.isBlank()) status = "SIGNED";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public DocumentRecord getDocument() { return document; }
    public void setDocument(DocumentRecord document) { this.document = document; }
    public DocumentRevisionRecord getRevision() { return revision; }
    public void setRevision(DocumentRevisionRecord revision) { this.revision = revision; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public UUID getEntityId() { return entityId; }
    public void setEntityId(UUID entityId) { this.entityId = entityId; }
    public UUID getWorkflowStepId() { return workflowStepId; }
    public void setWorkflowStepId(UUID workflowStepId) { this.workflowStepId = workflowStepId; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getMeaning() { return meaning; }
    public void setMeaning(String meaning) { this.meaning = meaning; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Instant getSignedAt() { return signedAt; }
    public void setSignedAt(Instant signedAt) { this.signedAt = signedAt; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public String getTimestampDisplay() { return timestampDisplay; }
    public void setTimestampDisplay(String timestampDisplay) { this.timestampDisplay = timestampDisplay; }
    public String getAuthenticationMethod() { return authenticationMethod; }
    public void setAuthenticationMethod(String authenticationMethod) { this.authenticationMethod = authenticationMethod; }
    public String getSignatureId() { return signatureId; }
    public void setSignatureId(String signatureId) { this.signatureId = signatureId; }
    public String getVerificationId() { return verificationId; }
    public void setVerificationId(String verificationId) { this.verificationId = verificationId; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public String getDocumentChecksumBeforeSign() { return documentChecksumBeforeSign; }
    public void setDocumentChecksumBeforeSign(String documentChecksumBeforeSign) { this.documentChecksumBeforeSign = documentChecksumBeforeSign; }
    public String getDocumentChecksumAfterSign() { return documentChecksumAfterSign; }
    public void setDocumentChecksumAfterSign(String documentChecksumAfterSign) { this.documentChecksumAfterSign = documentChecksumAfterSign; }
    public String getSourceFileVersionId() { return sourceFileVersionId; }
    public void setSourceFileVersionId(String sourceFileVersionId) { this.sourceFileVersionId = sourceFileVersionId; }
    public String getReviewPdfVersionId() { return reviewPdfVersionId; }
    public void setReviewPdfVersionId(String reviewPdfVersionId) { this.reviewPdfVersionId = reviewPdfVersionId; }
    public String getPublishedPdfVersionId() { return publishedPdfVersionId; }
    public void setPublishedPdfVersionId(String publishedPdfVersionId) { this.publishedPdfVersionId = publishedPdfVersionId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
