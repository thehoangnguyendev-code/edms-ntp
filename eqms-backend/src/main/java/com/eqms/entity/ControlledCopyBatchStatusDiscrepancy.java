package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Records a batch whose stored status row does not match the status derived from its member
 *  copies, as found by the periodic {@code ControlledCopyBatchDiscrepancyScanner}. This table is
 *  purely an alert log for manual review: the scanner never uses it to silently rewrite batch
 *  data, since a background job "fixing" a GMP status transition without human review could mask
 *  a real defect instead of surfacing it. */
@Entity
@Table(name = "controlled_copy_batch_status_discrepancies")
public class ControlledCopyBatchStatusDiscrepancy {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_RESOLVED = "RESOLVED";

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ControlledCopyDistributionBatch batch;

    @Column(name = "batch_number", nullable = false, length = 120)
    private String batchNumber;

    @Column(name = "expected_status_code", nullable = false, length = 40)
    private String expectedStatusCode;

    @Column(name = "actual_status_code", nullable = false, length = 40)
    private String actualStatusCode;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt;

    @Column(name = "last_checked_at", nullable = false)
    private Instant lastCheckedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public ControlledCopyDistributionBatch getBatch() { return batch; }
    public void setBatch(ControlledCopyDistributionBatch batch) { this.batch = batch; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }
    public String getExpectedStatusCode() { return expectedStatusCode; }
    public void setExpectedStatusCode(String expectedStatusCode) { this.expectedStatusCode = expectedStatusCode; }
    public String getActualStatusCode() { return actualStatusCode; }
    public void setActualStatusCode(String actualStatusCode) { this.actualStatusCode = actualStatusCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getDetectedAt() { return detectedAt; }
    public void setDetectedAt(Instant detectedAt) { this.detectedAt = detectedAt; }
    public Instant getLastCheckedAt() { return lastCheckedAt; }
    public void setLastCheckedAt(Instant lastCheckedAt) { this.lastCheckedAt = lastCheckedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
