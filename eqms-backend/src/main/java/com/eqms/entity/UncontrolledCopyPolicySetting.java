package com.eqms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Single-row Uncontrolled Copy policy settings, mirroring {@link ControlledCopyPolicySetting}'s
 * pattern but simplified per the approved plan: no expiry-limits sub-table, no DCO delivery
 * redirection -- only eligibility default (approval required), validity, and the mandatory
 * watermark/stamp marking config (jsonb, ControlledCopyStatusMarking-shaped).
 */
@Entity
@Table(name = "uncontrolled_copy_policy_settings")
public class UncontrolledCopyPolicySetting {

    public static final UUID DEFAULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000301");

    @Id
    private UUID id = DEFAULT_ID;

    @Column(name = "approval_required", nullable = false)
    private boolean approvalRequired = true;

    @Column(name = "validity_hours", nullable = false)
    private int validityHours = 72;

    @Column(name = "allow_redownload", nullable = false)
    private boolean allowRedownload = true;

    /** ControlledCopyStatusMarking-shaped watermark/stamp config, mandatory (non-optional) watermark. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "marking", columnDefinition = "jsonb")
    private JsonNode marking;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (id == null) id = DEFAULT_ID;
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public boolean isApprovalRequired() { return approvalRequired; }
    public void setApprovalRequired(boolean approvalRequired) { this.approvalRequired = approvalRequired; }
    public int getValidityHours() { return validityHours; }
    public void setValidityHours(int validityHours) { this.validityHours = validityHours; }
    public boolean isAllowRedownload() { return allowRedownload; }
    public void setAllowRedownload(boolean allowRedownload) { this.allowRedownload = allowRedownload; }
    public JsonNode getMarking() { return marking; }
    public void setMarking(JsonNode marking) { this.marking = marking; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
