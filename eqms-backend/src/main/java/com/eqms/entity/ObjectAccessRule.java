package com.eqms.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "object_access_rules")
public class ObjectAccessRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Canonical rule subjects. An empty set means the rule applies to all Access Profiles. */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "access_profile_object_rules",
            joinColumns = @JoinColumn(name = "object_access_rule_id"),
            inverseJoinColumns = @JoinColumn(name = "access_profile_id"))
    private Set<RoleDefinition> accessProfiles = new LinkedHashSet<>();

    @Column(name = "resource_type", nullable = false, length = 50)
    private String resourceType;

    @Column(name = "resource_id")
    private UUID resourceId;

    @Column(name = "resource_name", length = 200)
    private String resourceName;

    // Mapped as a native String[] rather than List<String> -- with this Hibernate version,
    // @JdbcTypeCode(SqlTypes.ARRAY) on a List<String> was silently overridden by Hibernate's
    // JSON-by-default handling for List-typed attributes, failing schema validation against the
    // real Postgres text[] column. A raw array type does not hit that default.
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "actions", columnDefinition = "text[]")
    private String[] actions;

    @Column(nullable = false, length = 10)
    private String effect = "ALLOW";

    @Column(nullable = false)
    private int priority = 0;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /** The Department that owns this rule. Its Department Head manages it; it only ever grants or refuses VIEW of records
     *  of that Department. NULL: an ordinary rule managed under Security & Authorization. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_department_id")
    private Department ownerDepartment;

    /** The Business Unit that owns the rule (a share of the whole Unit, made by its Head of Unit). Mutually exclusive with the owner Department. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_business_unit_id")
    private BusinessUnit ownerBusinessUnit;

    /** Who made the share, by authority at that time (ADMIN, UNIT_HEAD, DEPARTMENT_HEAD, DELEGATE): it decides who may remove it. */
    @Column(name = "created_authority", length = 20)
    private String createdAuthority;

    /** Individual users the rule is for, besides Access Profiles. A rule with neither applies to everyone. */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "object_access_rule_users",
            joinColumns = @JoinColumn(name = "object_access_rule_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id"))
    @org.hibernate.annotations.BatchSize(size = 50)
    private Set<UserAccount> granteeUsers = new LinkedHashSet<>();

    /** The rule is for every user of the owner Department (users.department_id = owner). Only for a Department-owned rule. */
    @Column(name = "grantee_whole_department", nullable = false)
    private boolean granteeWholeDepartment;

    /** Positions (job titles) the rule is for: every user whose Position is one of them. */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "object_access_rule_positions",
            joinColumns = @JoinColumn(name = "object_access_rule_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id"))
    @org.hibernate.annotations.BatchSize(size = 50)
    private Set<Position> granteePositions = new LinkedHashSet<>();

    /** The rule is for every user who may open the Knowledge Base. Only for a Department-owned rule. */
    @Column(name = "grantee_everyone", nullable = false)
    private boolean granteeEveryone;

    /** Other Departments the rule is for: every user whose Department (foreign key) is one of them. */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "object_access_rule_departments",
            joinColumns = @JoinColumn(name = "object_access_rule_id"),
            inverseJoinColumns = @JoinColumn(name = "department_id"))
    @org.hibernate.annotations.BatchSize(size = 50)
    private Set<Department> granteeDepartments = new LinkedHashSet<>();

    /** The documents of a rule of the target DOCUMENT (a Department rule that names specific documents). */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "object_access_rule_documents",
            joinColumns = @JoinColumn(name = "object_access_rule_id"),
            inverseJoinColumns = @JoinColumn(name = "document_id"))
    @org.hibernate.annotations.BatchSize(size = 50)
    private Set<DocumentRecord> documents = new LinkedHashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private UserAccount createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private UserAccount updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Set<RoleDefinition> getAccessProfiles() { return accessProfiles; }
    public void setAccessProfiles(Set<RoleDefinition> accessProfiles) { this.accessProfiles = accessProfiles == null ? new LinkedHashSet<>() : new LinkedHashSet<>(accessProfiles); }
    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }
    public UUID getResourceId() { return resourceId; }
    public void setResourceId(UUID resourceId) { this.resourceId = resourceId; }
    public String getResourceName() { return resourceName; }
    public void setResourceName(String resourceName) { this.resourceName = resourceName; }
    public List<String> getActions() { return actions == null ? null : Arrays.asList(actions); }
    public void setActions(List<String> actions) { this.actions = actions == null ? null : actions.toArray(new String[0]); }
    public String getEffect() { return effect; }
    public void setEffect(String effect) { this.effect = effect; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public UserAccount getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserAccount createdBy) { this.createdBy = createdBy; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UserAccount updatedBy) { this.updatedBy = updatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public BusinessUnit getOwnerBusinessUnit() { return ownerBusinessUnit; }
    public void setOwnerBusinessUnit(BusinessUnit ownerBusinessUnit) { this.ownerBusinessUnit = ownerBusinessUnit; }
    public String getCreatedAuthority() { return createdAuthority; }
    public void setCreatedAuthority(String createdAuthority) { this.createdAuthority = createdAuthority; }
    public Department getOwnerDepartment() { return ownerDepartment; }
    public void setOwnerDepartment(Department ownerDepartment) { this.ownerDepartment = ownerDepartment; }
    public Set<DocumentRecord> getDocuments() { return documents; }
    public void setDocuments(Set<DocumentRecord> documents) { this.documents = documents; }
    public boolean isGranteeEveryone() { return granteeEveryone; }
    public void setGranteeEveryone(boolean granteeEveryone) { this.granteeEveryone = granteeEveryone; }
    public Set<Department> getGranteeDepartments() { return granteeDepartments; }
    public void setGranteeDepartments(Set<Department> granteeDepartments) { this.granteeDepartments = granteeDepartments == null ? new LinkedHashSet<>() : new LinkedHashSet<>(granteeDepartments); }
    public boolean isGranteeWholeDepartment() { return granteeWholeDepartment; }
    public void setGranteeWholeDepartment(boolean granteeWholeDepartment) { this.granteeWholeDepartment = granteeWholeDepartment; }
    public Set<Position> getGranteePositions() { return granteePositions; }
    public void setGranteePositions(Set<Position> granteePositions) { this.granteePositions = granteePositions == null ? new LinkedHashSet<>() : new LinkedHashSet<>(granteePositions); }
    public Set<UserAccount> getGranteeUsers() { return granteeUsers; }
    public void setGranteeUsers(Set<UserAccount> granteeUsers) { this.granteeUsers = granteeUsers; }
}
