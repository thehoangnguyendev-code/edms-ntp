package com.eqms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * One recorded run of the SoD violation scan (V505). Kept as its own history table -- mirrors
 * how Access Review and Audit Trail Periodic Review each keep their own record of "when was this
 * last checked and what was found" for GxP self-inspection evidence, rather than the scan only
 * ever showing its most recent result with nothing kept afterward.
 */
@Entity
@Table(name = "sod_violation_scans")
public class SodViolationScan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scanned_by")
    private UserAccount scannedBy;

    @Column(name = "scanned_at", nullable = false)
    private Instant scannedAt;

    @Column(name = "violation_count", nullable = false)
    private int violationCount;

    /** Full List&lt;SodViolationResponse&gt; snapshot at scan time. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "results", columnDefinition = "jsonb", nullable = false)
    private JsonNode results;

    public UUID getId() { return id; }

    public UserAccount getScannedBy() { return scannedBy; }
    public void setScannedBy(UserAccount scannedBy) { this.scannedBy = scannedBy; }

    public Instant getScannedAt() { return scannedAt; }
    public void setScannedAt(Instant scannedAt) { this.scannedAt = scannedAt; }

    public int getViolationCount() { return violationCount; }
    public void setViolationCount(int violationCount) { this.violationCount = violationCount; }

    public JsonNode getResults() { return results; }
    public void setResults(JsonNode results) { this.results = results; }
}
