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
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per (electronic Controlled Copy, OnlyOffice Form Role) pair -- which specific person may
 * sign that role's fields, and in what order, for THIS ONE distribution. Configured by the DCO on
 * a dedicated screen at the Controlled Copy's "Ready for Distribution" step, submitted together
 * with the Distribute action -- never a standing, reused-forever config on the Form itself (that
 * was V517's `form_role_assignments`, dropped: a Form's Controlled Copy goes to different people
 * on different occasions, so the signer list must be decided per occasion). Role names come from
 * whatever Roles the Author defined via OnlyOffice's "Manage Roles" when designing the Form's
 * fillable template -- discovered by scanning the committed .docxf (see EformFieldScanService),
 * not typed in free-form here.
 */
@Entity
@jakarta.persistence.EntityListeners(EntityChangeListener.class)
@Table(name = "eform_signer_assignments")
public class EformSignerAssignment {

    @Id
    private UUID id;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "controlled_copy_id", nullable = false)
    private ControlledCopyRecord controlledCopy;

    @Column(name = "role_name", nullable = false, length = 100)
    private String roleName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id", nullable = false)
    private UserAccount assignedUser;

    /** Signing order -- the next role to act is the smallest sequence greater than the active
     *  {@link EformFillRun}'s current_sequence. Need not be contiguous. */
    @Column(nullable = false)
    private int sequence;

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
    public long getLockVersion() { return lockVersion; }
    public ControlledCopyRecord getControlledCopy() { return controlledCopy; }
    public void setControlledCopy(ControlledCopyRecord controlledCopy) { this.controlledCopy = controlledCopy; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public UserAccount getAssignedUser() { return assignedUser; }
    public void setAssignedUser(UserAccount assignedUser) { this.assignedUser = assignedUser; }
    public int getSequence() { return sequence; }
    public void setSequence(int sequence) { this.sequence = sequence; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
