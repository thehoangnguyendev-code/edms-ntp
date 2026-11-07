package com.eqms.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/** A person a Head named to share in the Knowledge Base like the Head does, for one Department or for a whole Business Unit. */
@Entity
@Table(name = "knowledge_share_delegates")
public class KnowledgeShareDelegate {
    public static final String SCOPE_DEPARTMENT = "DEPARTMENT";
    public static final String SCOPE_BUSINESS_UNIT = "BUSINESS_UNIT";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "scope_kind", nullable = false, length = 20)
    private String scopeKind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_unit_id")
    private BusinessUnit businessUnit;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by")
    private UserAccount grantedBy;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt = Instant.now();

    public UUID getId() { return id; }
    public String getScopeKind() { return scopeKind; }
    public void setScopeKind(String scopeKind) { this.scopeKind = scopeKind; }
    public Department getDepartment() { return department; }
    public void setDepartment(Department department) { this.department = department; }
    public BusinessUnit getBusinessUnit() { return businessUnit; }
    public void setBusinessUnit(BusinessUnit businessUnit) { this.businessUnit = businessUnit; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public UserAccount getGrantedBy() { return grantedBy; }
    public void setGrantedBy(UserAccount grantedBy) { this.grantedBy = grantedBy; }
    public Instant getGrantedAt() { return grantedAt; }
}
