package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "controlled_copy_policy_settings")
public class ControlledCopyPolicySetting {

    public static final UUID DEFAULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000201");

    @Id
    private UUID id = DEFAULT_ID;

    // Distribution & Security
    @Column(name = "allow_email_distribution", nullable = false)
    private boolean allowEmailDistribution = true;

    @Column(name = "allow_portal_view", nullable = false)
    private boolean allowPortalView = true;

    @Column(name = "allow_download", nullable = false)
    private boolean allowDownload = false;

    @Column(name = "allow_print", nullable = false)
    private boolean allowPrint = false;

    @Column(name = "download_once", nullable = false)
    private boolean downloadOnce = false;

    @Column(name = "print_once", nullable = false)
    private boolean printOnce = false;

    @Column(name = "watermark_enabled", nullable = false)
    private boolean watermarkEnabled = true;

    @Column(name = "watermark_copy_number", nullable = false)
    private boolean watermarkCopyNumber = true;

    @Column(name = "watermark_recipient", nullable = false)
    private boolean watermarkRecipient = true;

    @Column(name = "watermark_distributed_date", nullable = false)
    private boolean watermarkDistributedDate = true;

    @Column(name = "watermark_expiry_date", nullable = false)
    private boolean watermarkExpiryDate = true;

    // Recall / Lost / Damaged
    @Column(name = "allow_manual_recall", nullable = false)
    private boolean allowManualRecall = true;

    @Column(name = "allow_report_lost", nullable = false)
    private boolean allowReportLost = true;

    @Column(name = "allow_report_damaged", nullable = false)
    private boolean allowReportDamaged = true;

    @Column(name = "allow_replacement_for_lost_damaged", nullable = false)
    private boolean allowReplacementForLostDamaged = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (id == null) id = DEFAULT_ID;
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public boolean isAllowEmailDistribution() { return allowEmailDistribution; }
    public void setAllowEmailDistribution(boolean allowEmailDistribution) { this.allowEmailDistribution = allowEmailDistribution; }
    public boolean isAllowPortalView() { return allowPortalView; }
    public void setAllowPortalView(boolean allowPortalView) { this.allowPortalView = allowPortalView; }
    public boolean isAllowDownload() { return allowDownload; }
    public void setAllowDownload(boolean allowDownload) { this.allowDownload = allowDownload; }
    public boolean isAllowPrint() { return allowPrint; }
    public void setAllowPrint(boolean allowPrint) { this.allowPrint = allowPrint; }
    public boolean isDownloadOnce() { return downloadOnce; }
    public void setDownloadOnce(boolean downloadOnce) { this.downloadOnce = downloadOnce; }
    public boolean isPrintOnce() { return printOnce; }
    public void setPrintOnce(boolean printOnce) { this.printOnce = printOnce; }
    public boolean isWatermarkEnabled() { return watermarkEnabled; }
    public void setWatermarkEnabled(boolean watermarkEnabled) { this.watermarkEnabled = watermarkEnabled; }
    public boolean isWatermarkCopyNumber() { return watermarkCopyNumber; }
    public void setWatermarkCopyNumber(boolean watermarkCopyNumber) { this.watermarkCopyNumber = watermarkCopyNumber; }
    public boolean isWatermarkRecipient() { return watermarkRecipient; }
    public void setWatermarkRecipient(boolean watermarkRecipient) { this.watermarkRecipient = watermarkRecipient; }
    public boolean isWatermarkDistributedDate() { return watermarkDistributedDate; }
    public void setWatermarkDistributedDate(boolean watermarkDistributedDate) { this.watermarkDistributedDate = watermarkDistributedDate; }
    public boolean isWatermarkExpiryDate() { return watermarkExpiryDate; }
    public void setWatermarkExpiryDate(boolean watermarkExpiryDate) { this.watermarkExpiryDate = watermarkExpiryDate; }
    public boolean isAllowManualRecall() { return allowManualRecall; }
    public void setAllowManualRecall(boolean allowManualRecall) { this.allowManualRecall = allowManualRecall; }
    public boolean isAllowReportLost() { return allowReportLost; }
    public void setAllowReportLost(boolean allowReportLost) { this.allowReportLost = allowReportLost; }
    public boolean isAllowReportDamaged() { return allowReportDamaged; }
    public void setAllowReportDamaged(boolean allowReportDamaged) { this.allowReportDamaged = allowReportDamaged; }
    public boolean isAllowReplacementForLostDamaged() { return allowReplacementForLostDamaged; }
    public void setAllowReplacementForLostDamaged(boolean allowReplacementForLostDamaged) { this.allowReplacementForLostDamaged = allowReplacementForLostDamaged; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
