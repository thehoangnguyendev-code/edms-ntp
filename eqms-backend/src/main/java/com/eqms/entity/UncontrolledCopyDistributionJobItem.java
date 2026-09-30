package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Mirrors {@link ControlledCopyDistributionJobItem}'s shape. One item per recipient of one Uncontrolled Copy distribution job. */
@Entity
@Table(name = "uncontrolled_copy_distribution_job_items")
public class UncontrolledCopyDistributionJobItem {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_id", nullable = false) private UncontrolledCopyDistributionJob job;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "uncontrolled_copy_id", nullable = false) private UncontrolledCopyRecord uncontrolledCopy;
    @Column(name = "recipient_email", length = 255) private String recipientEmail;
    @Column(nullable = false, length = 32) private String status;
    @Column(nullable = false) private int attempts;
    @Column(name = "last_error_code", length = 80) private String lastErrorCode;
    @Column(name = "last_error_message", columnDefinition = "TEXT") private String lastErrorMessage;
    @Column(name = "processing_started_at") private Instant processingStartedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @PrePersist void created() { if (id == null) id = UUID.randomUUID(); }
    public UUID getId(){return id;}
    public UncontrolledCopyDistributionJob getJob(){return job;} public void setJob(UncontrolledCopyDistributionJob v){job=v;}
    public UncontrolledCopyRecord getUncontrolledCopy(){return uncontrolledCopy;} public void setUncontrolledCopy(UncontrolledCopyRecord v){uncontrolledCopy=v;}
    public String getRecipientEmail(){return recipientEmail;} public void setRecipientEmail(String v){recipientEmail=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
    public int getAttempts(){return attempts;} public void setAttempts(int v){attempts=v;}
    public String getLastErrorCode(){return lastErrorCode;} public void setLastErrorCode(String v){lastErrorCode=v;}
    public String getLastErrorMessage(){return lastErrorMessage;} public void setLastErrorMessage(String v){lastErrorMessage=v;}
    public Instant getProcessingStartedAt(){return processingStartedAt;} public void setProcessingStartedAt(Instant v){processingStartedAt=v;}
    public Instant getCompletedAt(){return completedAt;} public void setCompletedAt(Instant v){completedAt=v;}
}
