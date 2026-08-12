package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_delivery_failures")
public class NotificationDeliveryFailure {
    @Id private UUID id;
    @Column(nullable = false, length = 255) private String recipient;
    @Column(name = "notification_type", nullable = false, length = 120) private String notificationType;
    @Column(name = "event_domain", length = 80) private String eventDomain;
    @Column(nullable = false, length = 20) private String channel = "EMAIL";
    @Column(name = "error_message", columnDefinition = "TEXT") private String errorMessage;
    @Column(name = "payload_json", columnDefinition = "TEXT") private String payloadJson;
    @Column(nullable = false) private int attempts = 1;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "last_attempt_at", nullable = false) private Instant lastAttemptAt;
    @Column(nullable = false, length = 30) private String status = "FAILED";
    @PrePersist void onCreate() { if (id == null) id = UUID.randomUUID(); if (createdAt == null) createdAt = Instant.now(); if (lastAttemptAt == null) lastAttemptAt = Instant.now(); }
    public UUID getId(){return id;} public void setId(UUID v){id=v;}
    public String getRecipient(){return recipient;} public void setRecipient(String v){recipient=v;}
    public String getNotificationType(){return notificationType;} public void setNotificationType(String v){notificationType=v;}
    public String getEventDomain(){return eventDomain;} public void setEventDomain(String v){eventDomain=v;}
    public String getChannel(){return channel;} public void setChannel(String v){channel=v;}
    public String getErrorMessage(){return errorMessage;} public void setErrorMessage(String v){errorMessage=v;}
    public String getPayloadJson(){return payloadJson;} public void setPayloadJson(String v){payloadJson=v;}
    public int getAttempts(){return attempts;} public void setAttempts(int v){attempts=v;}
    public Instant getCreatedAt(){return createdAt;} public Instant getLastAttemptAt(){return lastAttemptAt;} public void setLastAttemptAt(Instant v){lastAttemptAt=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;}
}
