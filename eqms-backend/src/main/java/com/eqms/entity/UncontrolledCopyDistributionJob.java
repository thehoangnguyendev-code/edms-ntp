package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Mirrors {@link ControlledCopyDistributionJob}'s shape; references an UncontrolledCopyRecord directly since Uncontrolled Copy has no distribution-batch concept. */
@Entity
@Table(name = "uncontrolled_copy_distribution_jobs")
public class UncontrolledCopyDistributionJob {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "uncontrolled_copy_id", nullable = false) private UncontrolledCopyRecord uncontrolledCopy;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "requested_by_user_id", nullable = false) private UserAccount requestedBy;
    @Column(name = "action_type", nullable = false, length = 20) private String actionType = "DISTRIBUTE";
    @Column(nullable = false, length = 32) private String status;
    @Column(name = "total_items", nullable = false) private int totalItems;
    @Column(name = "succeeded_items", nullable = false) private int succeededItems;
    @Column(name = "failed_items", nullable = false) private int failedItems;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @PrePersist void created() { if (id == null) id = UUID.randomUUID(); if (createdAt == null) createdAt = Instant.now(); }
    public UUID getId(){return id;} public void setId(UUID v){id=v;}
    public UncontrolledCopyRecord getUncontrolledCopy(){return uncontrolledCopy;} public void setUncontrolledCopy(UncontrolledCopyRecord v){uncontrolledCopy=v;}
    public UserAccount getRequestedBy(){return requestedBy;} public void setRequestedBy(UserAccount v){requestedBy=v;}
    public String getActionType(){return actionType;} public void setActionType(String v){actionType=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public int getTotalItems(){return totalItems;} public void setTotalItems(int v){totalItems=v;}
    public int getSucceededItems(){return succeededItems;} public void setSucceededItems(int v){succeededItems=v;}
    public int getFailedItems(){return failedItems;} public void setFailedItems(int v){failedItems=v;}
    public Instant getCreatedAt(){return createdAt;}
    public Instant getStartedAt(){return startedAt;} public void setStartedAt(Instant v){startedAt=v;}
    public Instant getCompletedAt(){return completedAt;} public void setCompletedAt(Instant v){completedAt=v;}
}
