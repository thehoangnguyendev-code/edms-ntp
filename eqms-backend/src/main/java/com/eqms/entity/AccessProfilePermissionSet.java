package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "access_profile_permission_sets")
@IdClass(AccessProfilePermissionSetId.class)
public class AccessProfilePermissionSet {

    @Id
    @Column(name = "access_profile_id")
    private UUID accessProfileId;

    @Id
    @Column(name = "permission_set_id")
    private UUID permissionSetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "access_profile_id", insertable = false, updatable = false)
    private RoleDefinition accessProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_set_id", insertable = false, updatable = false)
    private PermissionSet permissionSet;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by")
    private UserAccount assignedBy;

    @PrePersist
    void onAssign() {
        if (assignedAt == null) assignedAt = Instant.now();
    }

    public UUID getAccessProfileId() { return accessProfileId; }
    public void setAccessProfileId(UUID id) { this.accessProfileId = id; }
    public UUID getPermissionSetId() { return permissionSetId; }
    public void setPermissionSetId(UUID id) { this.permissionSetId = id; }
    public RoleDefinition getAccessProfile() { return accessProfile; }
    public PermissionSet getPermissionSet() { return permissionSet; }
    public Instant getAssignedAt() { return assignedAt; }
    public UserAccount getAssignedBy() { return assignedBy; }
    public void setAssignedBy(UserAccount assignedBy) { this.assignedBy = assignedBy; }
}
