package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A single EMAIL/TELEGRAM/WHATSAPP send deferred by digest mode or quiet hours
 * (NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2). Content is rendered once by {@link
 * com.eqms.service.NotificationDispatcher} at dispatch time and stored here as-is, so {@link
 * com.eqms.service.NotificationDigestScheduler} never needs to re-resolve variables/templates --
 * it only groups and sends what's already rendered. IN_APP is never queued here; it is always
 * delivered immediately (see NotificationDispatcher).
 */
@Entity
@Table(name = "notification_dispatch_queue")
public class NotificationDispatchQueue {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private NotificationPolicy policy;

    @Column(name = "event_code", nullable = false, length = 120)
    private String eventCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private UserAccount recipient;

    @Column(nullable = false, length = 20)
    private String channel;

    @Column(name = "rendered_subject", length = 255)
    private String renderedSubject;

    @Column(name = "rendered_body", columnDefinition = "text")
    private String renderedBody;

    @Column(name = "scheduled_for", nullable = false)
    private Instant scheduledFor;

    @Column(nullable = false, length = 20)
    private String status = STATUS_PENDING;

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public NotificationPolicy getPolicy() { return policy; }
    public void setPolicy(NotificationPolicy policy) { this.policy = policy; }
    public String getEventCode() { return eventCode; }
    public void setEventCode(String eventCode) { this.eventCode = eventCode; }
    public UserAccount getRecipient() { return recipient; }
    public void setRecipient(UserAccount recipient) { this.recipient = recipient; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getRenderedSubject() { return renderedSubject; }
    public void setRenderedSubject(String renderedSubject) { this.renderedSubject = renderedSubject; }
    public String getRenderedBody() { return renderedBody; }
    public void setRenderedBody(String renderedBody) { this.renderedBody = renderedBody; }
    public Instant getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(Instant scheduledFor) { this.scheduledFor = scheduledFor; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
}
