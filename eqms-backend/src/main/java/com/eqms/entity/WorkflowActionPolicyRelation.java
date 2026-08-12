package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Maps a {@link WorkflowActionPolicy} to a required {@link AuthorizationRelationDefinition}.
 * Additive schema for the hybrid AuthorizationEngine (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
 * §5.1) -- not yet consumed by any enforcement path.
 */
@Entity
@Table(name = "workflow_action_policy_relations")
public class WorkflowActionPolicyRelation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private WorkflowActionPolicy policy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "relation_definition_id", nullable = false)
    private AuthorizationRelationDefinition relationDefinition;

    @Column(name = "require_sequence", nullable = false)
    private boolean requireSequence = false;

    @Column(nullable = false)
    private int priority = 100;

    @Column(nullable = false)
    private boolean active = true;

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
    public WorkflowActionPolicy getPolicy() { return policy; }
    public void setPolicy(WorkflowActionPolicy policy) { this.policy = policy; }
    public AuthorizationRelationDefinition getRelationDefinition() { return relationDefinition; }
    public void setRelationDefinition(AuthorizationRelationDefinition relationDefinition) { this.relationDefinition = relationDefinition; }
    public boolean isRequireSequence() { return requireSequence; }
    public void setRequireSequence(boolean requireSequence) { this.requireSequence = requireSequence; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
