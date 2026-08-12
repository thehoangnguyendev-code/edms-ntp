package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "workflow_action_policies")
public class WorkflowActionPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "module_key", nullable = false, length = 80)
    private String moduleKey;

    @Column(name = "workflow_key", nullable = false, length = 80)
    private String workflowKey;

    @Column(name = "object_type", nullable = false, length = 80)
    private String objectType;

    @Column(name = "action_code", nullable = false, length = 120)
    private String actionCode;

    @Column(name = "from_status", nullable = false, length = 80)
    private String fromStatus;

    @Column(name = "document_type_id")
    private UUID documentTypeId;

    @Column(name = "required_permission_code", nullable = false, length = 160)
    private String requiredPermissionCode;

    @Column(name = "priority", nullable = false)
    private int priority = 100;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "is_system", nullable = false)
    private boolean system = false;

    @Column(name = "description")
    private String description;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "policy", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<WorkflowActionPolicyActor> actors = new ArrayList<>();

    /**
     * ANY = actor needs at least one of {@link #relations}; ALL = actor needs every one of them.
     * Additive field for the hybrid AuthorizationEngine (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
     * §5.1) -- not yet consumed by any enforcement path.
     */
    @Column(name = "relation_match_rule", nullable = false, length = 10)
    private String relationMatchRule = "ANY";

    @OneToMany(mappedBy = "policy", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<WorkflowActionPolicyRelation> relations = new ArrayList<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public long getVersion() { return version; }
    public String getModuleKey() { return moduleKey; }
    public void setModuleKey(String moduleKey) { this.moduleKey = moduleKey; }
    public String getWorkflowKey() { return workflowKey; }
    public void setWorkflowKey(String workflowKey) { this.workflowKey = workflowKey; }
    public String getObjectType() { return objectType; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public String getActionCode() { return actionCode; }
    public void setActionCode(String actionCode) { this.actionCode = actionCode; }
    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }
    public UUID getDocumentTypeId() { return documentTypeId; }
    public void setDocumentTypeId(UUID documentTypeId) { this.documentTypeId = documentTypeId; }
    public String getRequiredPermissionCode() { return requiredPermissionCode; }
    public void setRequiredPermissionCode(String requiredPermissionCode) { this.requiredPermissionCode = requiredPermissionCode; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isSystem() { return system; }
    public void setSystem(boolean system) { this.system = system; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<WorkflowActionPolicyActor> getActors() { return actors; }
    public void setActors(List<WorkflowActionPolicyActor> actors) { this.actors = actors; }
    public String getRelationMatchRule() { return relationMatchRule; }
    public void setRelationMatchRule(String relationMatchRule) { this.relationMatchRule = relationMatchRule; }
    public List<WorkflowActionPolicyRelation> getRelations() { return relations; }
    public void setRelations(List<WorkflowActionPolicyRelation> relations) { this.relations = relations; }
}
