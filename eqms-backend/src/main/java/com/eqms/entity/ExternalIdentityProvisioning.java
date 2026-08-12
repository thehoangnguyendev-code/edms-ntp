package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "external_identity_provisioning", uniqueConstraints = {
        @UniqueConstraint(name = "uk_external_identity_provider_email", columnNames = {"provider", "email_normalized"})
})
public class ExternalIdentityProvisioning {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "eqms_user_id", nullable = false, unique = true)
    private UserAccount user;
    @Column(nullable = false, length = 40) private String provider = "MICROSOFT_ENTRA";
    @Column(name = "email_normalized", nullable = false, length = 255) private String emailNormalized;
    @Column(name = "tenant_id", length = 120) private String tenantId;
    @Column(name = "object_id", length = 120) private String objectId;
    @Column(name = "invitation_id", length = 120) private String invitationId;
    @Column(nullable = false, length = 30) private String status = "NOT_INVITED";
    @Column(name = "invited_at") private Instant invitedAt;
    @Column(name = "redeemed_at") private Instant redeemedAt;
    @Column(name = "disabled_at") private Instant disabledAt;
    @Column(name = "last_error_code", length = 120) private String lastErrorCode;
    @Column(name = "last_error_message", length = 2000) private String lastErrorMessage;
    @Column(nullable = false) private int attemptCount;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @Column(name = "last_graph_checked_at") private Instant lastGraphCheckedAt;
    /**
     * Identity lifecycle ownership is deliberately persisted instead of inferred from a role or
     * email.  Only a guest created through the EQMS invitation flow is safe for EQMS to disable
     * or delete in Microsoft Entra.
     */
    @Column(name = "lifecycle_ownership", nullable = false, length = 40)
    private String lifecycleOwnership = "UNKNOWN";
    @Column(name = "directory_user_type", length = 20)
    private String directoryUserType;
    @Column(name = "pending_operation", length = 40)
    private String pendingOperation;
    @Column(name = "pending_reason", length = 1000)
    private String pendingReason;
    @Column(name = "operation_requested_at")
    private Instant operationRequestedAt;
    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @PrePersist void create() { Instant now = Instant.now(); createdAt = createdAt == null ? now : createdAt; updatedAt = now; }
    @PreUpdate void update() { updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public String getProvider() { return provider; }
    public String getEmailNormalized() { return emailNormalized; }
    public void setEmailNormalized(String value) { this.emailNormalized = value; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String value) { this.tenantId = value; }
    public String getObjectId() { return objectId; }
    public void setObjectId(String value) { this.objectId = value; }
    public String getInvitationId() { return invitationId; }
    public void setInvitationId(String value) { this.invitationId = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { this.status = value; }
    public Instant getInvitedAt() { return invitedAt; }
    public void setInvitedAt(Instant value) { this.invitedAt = value; }
    public Instant getRedeemedAt() { return redeemedAt; }
    public void setRedeemedAt(Instant value) { this.redeemedAt = value; }
    public Instant getDisabledAt() { return disabledAt; }
    public void setDisabledAt(Instant value) { this.disabledAt = value; }
    public String getLastErrorCode() { return lastErrorCode; }
    public void setLastErrorCode(String value) { this.lastErrorCode = value; }
    public String getLastErrorMessage() { return lastErrorMessage; }
    public void setLastErrorMessage(String value) { this.lastErrorMessage = value; }
    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int value) { this.attemptCount = value; }
    public Instant getLastGraphCheckedAt() { return lastGraphCheckedAt; }
    public void setLastGraphCheckedAt(Instant value) { this.lastGraphCheckedAt = value; }
    public String getLifecycleOwnership() { return lifecycleOwnership; }
    public void setLifecycleOwnership(String value) { this.lifecycleOwnership = value; }
    public String getDirectoryUserType() { return directoryUserType; }
    public void setDirectoryUserType(String value) { this.directoryUserType = value; }
    public String getPendingOperation() { return pendingOperation; }
    public void setPendingOperation(String value) { this.pendingOperation = value; }
    public String getPendingReason() { return pendingReason; }
    public void setPendingReason(String value) { this.pendingReason = value; }
    public Instant getOperationRequestedAt() { return operationRequestedAt; }
    public void setOperationRequestedAt(Instant value) { this.operationRequestedAt = value; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(Instant value) { this.nextAttemptAt = value; }
}
