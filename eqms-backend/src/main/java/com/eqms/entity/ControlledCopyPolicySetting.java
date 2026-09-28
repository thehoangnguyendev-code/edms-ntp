package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    /** Longest an external recipient may keep a controlled copy open before the viewer locks (minutes). */
    @Column(name = "preview_session_minutes", nullable = false)
    private int previewSessionMinutes = 120;

    @Column(name = "print_once", nullable = false)
    private boolean printOnce = false;

    @Column(name = "watermark_enabled", nullable = false)
    private boolean watermarkEnabled = true;

    @Column(name = "watermark_copy_number", nullable = false)
    private boolean watermarkCopyNumber = true;

    @Column(name = "watermark_recipient", nullable = false)
    private boolean watermarkRecipient = false;

    @Column(name = "watermark_distributed_date", nullable = false)
    private boolean watermarkDistributedDate = false;

    @Column(name = "watermark_expiry_date", nullable = false)
    private boolean watermarkExpiryDate = false;

    // Stamp and watermark burned into every issued Controlled Copy PDF
    @Column(name = "stamp_enabled", nullable = false)
    private boolean stampEnabled = true;

    @Column(name = "stamp_text", nullable = false)
    private String stampText = "CONTROLLED COPY";

    @Column(name = "stamp_color", nullable = false)
    private String stampColor = "#C00000";

    @Column(name = "stamp_position", nullable = false)
    private String stampPosition = "TOP_RIGHT";

    /** One of {@link com.eqms.service.ControlledCopyPdfMarkingService}'s bundled font families (e.g. NOTO_SANS, OSWALD). */
    @Column(name = "stamp_font_family", nullable = false)
    private String stampFontFamily = "NOTO_SANS";

    @Column(name = "watermark_font_family", nullable = false)
    private String watermarkFontFamily = "NOTO_SANS";

    /** Stamp/watermark for withdrawn and cancelled copies, one object per status (see ControlledCopyStatusMarking). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "status_marking", columnDefinition = "jsonb")
    private JsonNode statusMarking;

    /** Per-page placement rules for the issue-time stamp/watermark (see MarkingPlacementRule). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "marking_placements", columnDefinition = "jsonb")
    private JsonNode markingPlacements;

    @Column(name = "stamp_margin_mm", nullable = false)
    private int stampMarginMm = 4;

    @Column(name = "stamp_size", nullable = false)
    private String stampSize = "SMALL";

    @Column(name = "stamp_opacity_percent", nullable = false)
    private int stampOpacityPercent = 90;

    @Column(name = "stamp_pages", nullable = false)
    private String stampPages = "ALL";

    @Column(name = "stamp_show_copy_number", nullable = false)
    private boolean stampShowCopyNumber = true;

    @Column(name = "stamp_show_recipient", nullable = false)
    private boolean stampShowRecipient = false;

    @Column(name = "stamp_show_distributed_date", nullable = false)
    private boolean stampShowDistributedDate = false;

    @Column(name = "stamp_show_expiry_date", nullable = false)
    private boolean stampShowExpiryDate = false;

    @Column(name = "watermark_text", nullable = false)
    private String watermarkText = "CONTROLLED COPY";

    @Column(name = "watermark_color", nullable = false)
    private String watermarkColor = "#808080";

    @Column(name = "watermark_opacity_percent", nullable = false)
    private int watermarkOpacityPercent = 15;

    @Column(name = "watermark_angle_degrees", nullable = false)
    private int watermarkAngleDegrees = 35;

    @Column(name = "watermark_layer", nullable = false)
    private String watermarkLayer = "BEHIND";

    @Column(name = "watermark_pages", nullable = false)
    private String watermarkPages = "ALL";


    // Recall / Lost / Damaged
    @Column(name = "allow_manual_recall", nullable = false)
    private boolean allowManualRecall = true;

    @Column(name = "allow_report_lost_damaged", nullable = false)
    private boolean allowReportLostDamaged = true;

    @Column(name = "allow_replacement_for_lost_damaged", nullable = false)
    private boolean allowReplacementForLostDamaged = true;

    // Delivery routing: when enabled, the designated DCO receives the printable link/attachment
    // instead of the original requester(s) — for recipients without a computer/phone to view it.
    @Column(name = "redirect_delivery_to_dco", nullable = false)
    private boolean redirectDeliveryToDco = false;

    @Column(name = "dco_recipient_user_id")
    private UUID dcoRecipientUserId;

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
    public int getPreviewSessionMinutes() { return previewSessionMinutes; }
    public void setPreviewSessionMinutes(int previewSessionMinutes) { this.previewSessionMinutes = previewSessionMinutes; }
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
    public boolean isAllowReportLostDamaged() { return allowReportLostDamaged; }
    public void setAllowReportLostDamaged(boolean allowReportLostDamaged) { this.allowReportLostDamaged = allowReportLostDamaged; }
    public boolean isAllowReplacementForLostDamaged() { return allowReplacementForLostDamaged; }
    public void setAllowReplacementForLostDamaged(boolean allowReplacementForLostDamaged) { this.allowReplacementForLostDamaged = allowReplacementForLostDamaged; }
    public boolean isRedirectDeliveryToDco() { return redirectDeliveryToDco; }
    public void setRedirectDeliveryToDco(boolean redirectDeliveryToDco) { this.redirectDeliveryToDco = redirectDeliveryToDco; }
    public UUID getDcoRecipientUserId() { return dcoRecipientUserId; }
    public void setDcoRecipientUserId(UUID dcoRecipientUserId) { this.dcoRecipientUserId = dcoRecipientUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public boolean isStampEnabled() { return stampEnabled; }
    public void setStampEnabled(boolean stampEnabled) { this.stampEnabled = stampEnabled; }
    public String getStampText() { return stampText; }
    public void setStampText(String stampText) { this.stampText = stampText; }
    public String getStampColor() { return stampColor; }
    public void setStampColor(String stampColor) { this.stampColor = stampColor; }
    public String getStampPosition() { return stampPosition; }
    public void setStampPosition(String stampPosition) { this.stampPosition = stampPosition; }
    public String getStampFontFamily() { return stampFontFamily; }
    public void setStampFontFamily(String stampFontFamily) { this.stampFontFamily = stampFontFamily; }
    public String getWatermarkFontFamily() { return watermarkFontFamily; }
    public void setWatermarkFontFamily(String watermarkFontFamily) { this.watermarkFontFamily = watermarkFontFamily; }
    public String getStampSize() { return stampSize; }
    public void setStampSize(String stampSize) { this.stampSize = stampSize; }
    public int getStampOpacityPercent() { return stampOpacityPercent; }
    public void setStampOpacityPercent(int stampOpacityPercent) { this.stampOpacityPercent = stampOpacityPercent; }
    public String getStampPages() { return stampPages; }
    public void setStampPages(String stampPages) { this.stampPages = stampPages; }
    public boolean isStampShowCopyNumber() { return stampShowCopyNumber; }
    public void setStampShowCopyNumber(boolean stampShowCopyNumber) { this.stampShowCopyNumber = stampShowCopyNumber; }
    public boolean isStampShowRecipient() { return stampShowRecipient; }
    public void setStampShowRecipient(boolean stampShowRecipient) { this.stampShowRecipient = stampShowRecipient; }
    public boolean isStampShowDistributedDate() { return stampShowDistributedDate; }
    public void setStampShowDistributedDate(boolean stampShowDistributedDate) { this.stampShowDistributedDate = stampShowDistributedDate; }
    public boolean isStampShowExpiryDate() { return stampShowExpiryDate; }
    public void setStampShowExpiryDate(boolean stampShowExpiryDate) { this.stampShowExpiryDate = stampShowExpiryDate; }
    public String getWatermarkText() { return watermarkText; }
    public void setWatermarkText(String watermarkText) { this.watermarkText = watermarkText; }
    public String getWatermarkColor() { return watermarkColor; }
    public void setWatermarkColor(String watermarkColor) { this.watermarkColor = watermarkColor; }
    public int getWatermarkOpacityPercent() { return watermarkOpacityPercent; }
    public void setWatermarkOpacityPercent(int watermarkOpacityPercent) { this.watermarkOpacityPercent = watermarkOpacityPercent; }
    public int getWatermarkAngleDegrees() { return watermarkAngleDegrees; }
    public void setWatermarkAngleDegrees(int watermarkAngleDegrees) { this.watermarkAngleDegrees = watermarkAngleDegrees; }
    public String getWatermarkPages() { return watermarkPages; }
    public void setWatermarkPages(String watermarkPages) { this.watermarkPages = watermarkPages; }
    public int getStampMarginMm() { return stampMarginMm; }
    public void setStampMarginMm(int stampMarginMm) { this.stampMarginMm = stampMarginMm; }
    public JsonNode getMarkingPlacements() { return markingPlacements; }
    public void setMarkingPlacements(JsonNode markingPlacements) { this.markingPlacements = markingPlacements; }
    public JsonNode getStatusMarking() { return statusMarking; }
    public void setStatusMarking(JsonNode statusMarking) { this.statusMarking = statusMarking; }
    public String getWatermarkLayer() { return watermarkLayer; }
    public void setWatermarkLayer(String watermarkLayer) { this.watermarkLayer = watermarkLayer; }
}
