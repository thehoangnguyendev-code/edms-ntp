package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "controlled_copy_distribution_job_items")
public class ControlledCopyDistributionJobItem {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_id", nullable = false) private ControlledCopyDistributionJob job;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "controlled_copy_id", nullable = false) private ControlledCopyRecord controlledCopy;
    @Column(nullable = false, length = 32) private String status;
    @Column(nullable = false) private int attempts;
    @Column(name = "last_error_code", length = 80) private String lastErrorCode;
    @Column(name = "last_error_message", columnDefinition = "TEXT") private String lastErrorMessage;
    @Column(name = "processing_started_at") private Instant processingStartedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @PrePersist void created() { if (id == null) id = UUID.randomUUID(); }
    public UUID getId(){return id;} public ControlledCopyDistributionJob getJob(){return job;} public void setJob(ControlledCopyDistributionJob v){job=v;} public ControlledCopyRecord getControlledCopy(){return controlledCopy;} public void setControlledCopy(ControlledCopyRecord v){controlledCopy=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public int getAttempts(){return attempts;} public void setAttempts(int v){attempts=v;} public String getLastErrorCode(){return lastErrorCode;} public void setLastErrorCode(String v){lastErrorCode=v;} public String getLastErrorMessage(){return lastErrorMessage;} public void setLastErrorMessage(String v){lastErrorMessage=v;} public Instant getProcessingStartedAt(){return processingStartedAt;} public void setProcessingStartedAt(Instant v){processingStartedAt=v;} public Instant getCompletedAt(){return completedAt;} public void setCompletedAt(Instant v){completedAt=v;}
}
