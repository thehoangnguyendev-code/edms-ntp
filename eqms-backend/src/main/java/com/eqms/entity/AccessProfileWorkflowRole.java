package com.eqms.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "access_profile_workflow_roles")
@IdClass(AccessProfileWorkflowRole.PK.class)
public class AccessProfileWorkflowRole {

    @Id
    @Column(name = "access_profile_id")
    private UUID accessProfileId;

    @Id
    @Column(name = "workflow_role", length = 80)
    private String workflowRole;

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

    public UUID getAccessProfileId() { return accessProfileId; }
    public void setAccessProfileId(UUID id) { this.accessProfileId = id; }
    public String getWorkflowRole() { return workflowRole; }
    public void setWorkflowRole(String workflowRole) { this.workflowRole = workflowRole; }
    public RoleDefinition getAccessProfile() { return accessProfile; }
    public Instant getAssignedAt() { return assignedAt; }
    public UserAccount getAssignedBy() { return assignedBy; }
    public void setAssignedBy(UserAccount assignedBy) { this.assignedBy = assignedBy; }

    public static class PK implements Serializable {
        private UUID accessProfileId;
        private String workflowRole;
        public PK() {}
        public PK(UUID accessProfileId, String workflowRole) {
            this.accessProfileId = accessProfileId;
            this.workflowRole = workflowRole;
        }
        @Override public boolean equals(Object o) {
            if (!(o instanceof PK pk)) return false;
            return Objects.equals(accessProfileId, pk.accessProfileId) && Objects.equals(workflowRole, pk.workflowRole);
        }
        @Override public int hashCode() { return Objects.hash(accessProfileId, workflowRole); }
    }
}
