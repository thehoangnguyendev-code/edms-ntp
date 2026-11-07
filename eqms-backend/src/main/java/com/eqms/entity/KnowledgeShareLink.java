package com.eqms.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A link to a folder (Business Unit, Department, Document Type of a Department) or to one document of the Knowledge Base. A signed-in user who
 * opens it is given that folder or document until the link expires or is revoked. Only the SHA-256 of the token is stored.
 */
@Entity
@Table(name = "knowledge_share_links")
public class KnowledgeShareLink {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    /** BUSINESS_UNIT, DEPARTMENT, DOCUMENT_TYPE or DOCUMENT. */
    @Column(name = "scope_kind", nullable = false, length = 20)
    private String scopeKind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_business_unit_id")
    private BusinessUnit ownerBusinessUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_department_id")
    private Department ownerDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_type_id")
    private DocumentType documentType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private DocumentRecord document;

    @Column(nullable = false, length = 300)
    private String label;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private UserAccount createdBy;

    @Column(name = "created_authority", nullable = false, length = 20)
    private String createdAuthority;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by")
    private UserAccount revokedBy;

    public boolean isUsable(Instant now) {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(now));
    }

    public UUID getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public String getScopeKind() { return scopeKind; }
    public void setScopeKind(String scopeKind) { this.scopeKind = scopeKind; }
    public BusinessUnit getOwnerBusinessUnit() { return ownerBusinessUnit; }
    public void setOwnerBusinessUnit(BusinessUnit ownerBusinessUnit) { this.ownerBusinessUnit = ownerBusinessUnit; }
    public Department getOwnerDepartment() { return ownerDepartment; }
    public void setOwnerDepartment(Department ownerDepartment) { this.ownerDepartment = ownerDepartment; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }
    public DocumentRecord getDocument() { return document; }
    public void setDocument(DocumentRecord document) { this.document = document; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public UserAccount getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserAccount createdBy) { this.createdBy = createdBy; }
    public String getCreatedAuthority() { return createdAuthority; }
    public void setCreatedAuthority(String createdAuthority) { this.createdAuthority = createdAuthority; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
    public UserAccount getRevokedBy() { return revokedBy; }
    public void setRevokedBy(UserAccount revokedBy) { this.revokedBy = revokedBy; }
}
