package com.eqms.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "user_access_profiles")
@IdClass(UserAccessProfile.PK.class)
public class UserAccessProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "access_profile_id")
    private UUID accessProfileId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "access_profile_id", insertable = false, updatable = false)
    private RoleDefinition accessProfile;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by")
    private UserAccount assignedBy;

    @PrePersist
    void onAssign() { if (assignedAt == null) assignedAt = Instant.now(); }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public UUID getAccessProfileId() { return accessProfileId; }
    public void setAccessProfileId(UUID id) { this.accessProfileId = id; }
    public UserAccount getUser() { return user; }
    public RoleDefinition getAccessProfile() { return accessProfile; }
    public Instant getAssignedAt() { return assignedAt; }
    public UserAccount getAssignedBy() { return assignedBy; }
    public void setAssignedBy(UserAccount assignedBy) { this.assignedBy = assignedBy; }

    public static class PK implements Serializable {
        private UUID userId;
        private UUID accessProfileId;
        public PK() {}
        public PK(UUID userId, UUID accessProfileId) {
            this.userId = userId;
            this.accessProfileId = accessProfileId;
        }
        @Override public boolean equals(Object o) {
            if (!(o instanceof PK pk)) return false;
            return Objects.equals(userId, pk.userId) && Objects.equals(accessProfileId, pk.accessProfileId);
        }
        @Override public int hashCode() { return Objects.hash(userId, accessProfileId); }
    }
}
