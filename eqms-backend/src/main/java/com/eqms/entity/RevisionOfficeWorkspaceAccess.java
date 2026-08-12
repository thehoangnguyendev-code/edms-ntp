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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A traceable, per-user SharePoint workspace grant.  It deliberately stores a
 * Graph permission id rather than a sharing URL, because URLs can contain
 * bearer-like tokens and must never be persisted in audit data.
 */
@Entity
@Table(name = "revision_office_workspace_access")
public class RevisionOfficeWorkspaceAccess {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revision_id", nullable = false)
    private DocumentRevisionRecord revision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "access_role", nullable = false, length = 30)
    private String accessRole;

    @Column(name = "access_mode", nullable = false, length = 20)
    private String accessMode;

    @Column(name = "sharepoint_permission_id", length = 255)
    private String sharePointPermissionId;

    @Column(name = "grant_status", nullable = false, length = 20)
    private String grantStatus;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (grantStatus == null) grantStatus = "PENDING";
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public DocumentRevisionRecord getRevision() { return revision; }
    public void setRevision(DocumentRevisionRecord revision) { this.revision = revision; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public String getAccessRole() { return accessRole; }
    public void setAccessRole(String accessRole) { this.accessRole = accessRole; }
    public String getAccessMode() { return accessMode; }
    public void setAccessMode(String accessMode) { this.accessMode = accessMode; }
    public String getSharePointPermissionId() { return sharePointPermissionId; }
    public void setSharePointPermissionId(String sharePointPermissionId) { this.sharePointPermissionId = sharePointPermissionId; }
    public String getGrantStatus() { return grantStatus; }
    public void setGrantStatus(String grantStatus) { this.grantStatus = grantStatus; }
    public Instant getGrantedAt() { return grantedAt; }
    public void setGrantedAt(Instant grantedAt) { this.grantedAt = grantedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
}
