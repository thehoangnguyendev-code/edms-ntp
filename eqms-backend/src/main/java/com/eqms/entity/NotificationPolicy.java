package com.eqms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Delivery rule for one {@link NotificationEventDefinition}: who receives it, on which
 * channels, and when (digest/quiet hours/escalation). Content itself lives in {@link
 * NotificationTemplateVersion} — this row never holds wording, only "who/how/when".
 */
@Entity
@Table(name = "notification_policies")
public class NotificationPolicy {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_DISABLED = "DISABLED";

    public static final String DIGEST_IMMEDIATE = "IMMEDIATE";
    public static final String DIGEST_DAILY = "DAILY_DIGEST";
    public static final String DIGEST_WEEKLY = "WEEKLY_DIGEST";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "event_code", nullable = false, unique = true, length = 120)
    private String eventCode;

    @Column(nullable = false, length = 20)
    private String status = STATUS_ACTIVE;

    /** Comma-separated: IN_APP, EMAIL, ESCALATION — subset of the event's supportedChannels. */
    @Column(name = "enabled_channels", nullable = false, length = 120)
    private String enabledChannels = "IN_APP";

    /** JSON audience rules, e.g. [{"type":"PERMISSION","value":"documents.workspace.manage"},{"type":"OWNER"}]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recipient_rules", nullable = false, columnDefinition = "jsonb")
    private JsonNode recipientRules;

    @Column(name = "digest_mode", nullable = false, length = 20)
    private String digestMode = DIGEST_IMMEDIATE;

    @Column(name = "quiet_hours_start", length = 5)
    private String quietHoursStart;

    @Column(name = "quiet_hours_end", length = 5)
    private String quietHoursEnd;

    @Column(name = "escalation_enabled", nullable = false)
    private boolean escalationEnabled = false;

    @Column(name = "escalation_after_minutes")
    private Integer escalationAfterMinutes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "escalation_recipient_rules", nullable = false, columnDefinition = "jsonb")
    private JsonNode escalationRecipientRules;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private UserAccount updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getEventCode() { return eventCode; }
    public void setEventCode(String eventCode) { this.eventCode = eventCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getEnabledChannels() { return enabledChannels; }
    public void setEnabledChannels(String enabledChannels) { this.enabledChannels = enabledChannels; }
    public JsonNode getRecipientRules() { return recipientRules; }
    public void setRecipientRules(JsonNode recipientRules) { this.recipientRules = recipientRules; }
    public String getDigestMode() { return digestMode; }
    public void setDigestMode(String digestMode) { this.digestMode = digestMode; }
    public String getQuietHoursStart() { return quietHoursStart; }
    public void setQuietHoursStart(String quietHoursStart) { this.quietHoursStart = quietHoursStart; }
    public String getQuietHoursEnd() { return quietHoursEnd; }
    public void setQuietHoursEnd(String quietHoursEnd) { this.quietHoursEnd = quietHoursEnd; }
    public boolean isEscalationEnabled() { return escalationEnabled; }
    public void setEscalationEnabled(boolean escalationEnabled) { this.escalationEnabled = escalationEnabled; }
    public Integer getEscalationAfterMinutes() { return escalationAfterMinutes; }
    public void setEscalationAfterMinutes(Integer escalationAfterMinutes) { this.escalationAfterMinutes = escalationAfterMinutes; }
    public JsonNode getEscalationRecipientRules() { return escalationRecipientRules; }
    public void setEscalationRecipientRules(JsonNode escalationRecipientRules) { this.escalationRecipientRules = escalationRecipientRules; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UserAccount updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
