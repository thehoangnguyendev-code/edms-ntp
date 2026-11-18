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

    /** Facts captured with the snapshot (V803). Null on a campaign made before they existed. */
    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "inactive_days")
    private Integer inactiveDays;

    @Column(name = "inactive_flag")
    private Boolean inactiveFlag;

    @Column(name = "mfa_state", length = 30)
    private String mfaState;

    @Column(name = "time_limited_until")
    private Instant timeLimitedUntil;

    @Column(name = "open_sod_violations")
    private Integer openSodViolations;

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
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public Integer getInactiveDays() { return inactiveDays; }
    public void setInactiveDays(Integer inactiveDays) { this.inactiveDays = inactiveDays; }
    public Boolean getInactiveFlag() { return inactiveFlag; }
    public void setInactiveFlag(Boolean inactiveFlag) { this.inactiveFlag = inactiveFlag; }
    public String getMfaState() { return mfaState; }
    public void setMfaState(String mfaState) { this.mfaState = mfaState; }
    public Instant getTimeLimitedUntil() { return timeLimitedUntil; }
    public void setTimeLimitedUntil(Instant timeLimitedUntil) { this.timeLimitedUntil = timeLimitedUntil; }
    public Integer getOpenSodViolations() { return openSodViolations; }
    public void setOpenSodViolations(Integer openSodViolations) { this.openSodViolations = openSodViolations; }
    public String getDecision() { return decision; }
    public void setDecision(String decision) { this.decision = decision; }
    public String getDecisionNote() { return decisionNote; }
    public void setDecisionNote(String decisionNote) { this.decisionNote = decisionNote; }
    public UUID getDecidedBy() { return decidedBy; }
    public void setDecidedBy(UUID decidedBy) { this.decidedBy = decidedBy; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant decidedAt) { this.decidedAt = decidedAt; }
}
