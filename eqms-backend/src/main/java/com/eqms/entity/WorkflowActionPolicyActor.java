package com.eqms.entity;

import com.eqms.enums.WorkflowActorType;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_action_policy_actors")
public class WorkflowActionPolicyActor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private WorkflowActionPolicy policy;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false, length = 80)
    private WorkflowActorType actorType;

    @Column(name = "actor_code", length = 160)
    private String actorCode;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() { if (createdAt == null) createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public WorkflowActionPolicy getPolicy() { return policy; }
    public void setPolicy(WorkflowActionPolicy policy) { this.policy = policy; }
    public WorkflowActorType getActorType() { return actorType; }
    public void setActorType(WorkflowActorType actorType) { this.actorType = actorType; }
    public String getActorCode() { return actorCode; }
    public void setActorCode(String actorCode) { this.actorCode = actorCode; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
