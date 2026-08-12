package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sod_constraints")
public class SodConstraint {

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

    @Column(name = "permission_code_a", nullable = false, length = 150)
    private String permissionCodeA;

    @Column(name = "permission_code_b", nullable = false, length = 150)
    private String permissionCodeB;

    @Column(nullable = false, length = 10)
    private String severity = "WARN";

    @Column(name = "regulation_ref", length = 300)
    private String regulationRef;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "system", nullable = false)
    private boolean system = false;

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
    public String getPermissionCodeA() { return permissionCodeA; }
    public void setPermissionCodeA(String permissionCodeA) { this.permissionCodeA = permissionCodeA; }
    public String getPermissionCodeB() { return permissionCodeB; }
    public void setPermissionCodeB(String permissionCodeB) { this.permissionCodeB = permissionCodeB; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getRegulationRef() { return regulationRef; }
    public void setRegulationRef(String regulationRef) { this.regulationRef = regulationRef; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isSystem() { return system; }
    public void setSystem(boolean system) { this.system = system; }
    public UserAccount getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserAccount createdBy) { this.createdBy = createdBy; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UserAccount updatedBy) { this.updatedBy = updatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
