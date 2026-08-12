package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One versioned snapshot of a policy's content for a single channel (IN_APP / EMAIL /
 * ESCALATION). Only one version per (policy, channel) is ACTIVE at a time; prior versions are
 * kept ARCHIVED for restore + history, per the field-level change history requirement.
 */
@Entity
@Table(name = "notification_template_versions")
public class NotificationTemplateVersion {

    public static final String CHANNEL_IN_APP = "IN_APP";
    public static final String CHANNEL_EMAIL = "EMAIL";
    public static final String CHANNEL_ESCALATION = "ESCALATION";

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_ARCHIVED = "ARCHIVED";
    public static final String STATUS_DRAFT = "DRAFT";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private NotificationPolicy policy;

    @Column(nullable = false, length = 20)
    private String channel;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(nullable = false, length = 20)
    private String status = STATUS_ACTIVE;

    /** In-app / escalation title, or (unused for EMAIL — subject is separate). */
    @Column(length = 255)
    private String title;

    /** In-app short summary body — deliberately short, never the full email body. */
    @Column(length = 500)
    private String summary;

    /** Email subject only. */
    @Column(length = 255)
    private String subject;

    /** Email HTML body, or escalation body text. */
    @Column(columnDefinition = "text")
    private String body;

    @Column(name = "action_url_template", length = 255)
    private String actionUrlTemplate;

    @Column(name = "variables_used", length = 1000)
    private String variablesUsed;

    @Column(name = "change_summary", length = 500)
    private String changeSummary;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private UserAccount createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public NotificationPolicy getPolicy() { return policy; }
    public void setPolicy(NotificationPolicy policy) { this.policy = policy; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public int getVersionNumber() { return versionNumber; }
    public void setVersionNumber(int versionNumber) { this.versionNumber = versionNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getActionUrlTemplate() { return actionUrlTemplate; }
    public void setActionUrlTemplate(String actionUrlTemplate) { this.actionUrlTemplate = actionUrlTemplate; }
    public String getVariablesUsed() { return variablesUsed; }
    public void setVariablesUsed(String variablesUsed) { this.variablesUsed = variablesUsed; }
    public String getChangeSummary() { return changeSummary; }
    public void setChangeSummary(String changeSummary) { this.changeSummary = changeSummary; }
    public UserAccount getCreatedBy() { return createdBy; }
    public void setCreatedBy(UserAccount createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
