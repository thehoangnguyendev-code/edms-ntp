package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "access_review_items")
public class AccessReviewItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false)
    private AccessReviewCampaign campaign;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "employee_code", length = 80)
    private String employeeCode;

    @Column(nullable = false, length = 120)
    private String username;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "user_status", length = 40)
    private String userStatus;

    @Column(name = "access_profiles", columnDefinition = "TEXT")
    private String accessProfiles;

    @Column(name = "permission_count", nullable = false)
    private int permissionCount;

    @Column(name = "is_super_admin", nullable = false)
    private boolean superAdmin;

    @Column(nullable = false, length = 30)
    private String decision = "PENDING";

    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    @Column(name = "decided_by")
    private UUID decidedBy;

    @Column(name = "decided_at")
    private Instant decidedAt;

    public UUID getId() { return id; }
    public AccessReviewCampaign getCampaign() { return campaign; }
    public void setCampaign(AccessReviewCampaign campaign) { this.campaign = campaign; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getEmployeeCode() { return employeeCode; }
    public void setEmployeeCode(String employeeCode) { this.employeeCode = employeeCode; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getUserStatus() { return userStatus; }
    public void setUserStatus(String userStatus) { this.userStatus = userStatus; }
    public String getAccessProfiles() { return accessProfiles; }
    public void setAccessProfiles(String accessProfiles) { this.accessProfiles = accessProfiles; }
    public int getPermissionCount() { return permissionCount; }
    public void setPermissionCount(int permissionCount) { this.permissionCount = permissionCount; }
    public boolean isSuperAdmin() { return superAdmin; }
    public void setSuperAdmin(boolean superAdmin) { this.superAdmin = superAdmin; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getDecisionNote() { return decisionNote; }
    public void setDecisionNote(String decisionNote) { this.decisionNote = decisionNote; }
    public UUID getDecidedBy() { return decidedBy; }
    public void setDecidedBy(UUID decidedBy) { this.decidedBy = decidedBy; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant decidedAt) { this.decidedAt = decidedAt; }
}
