package com.eqms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "user_notifications",
        indexes = {
                @Index(name = "idx_user_notifications_recipient_created_at", columnList = "recipient_user_id,created_at"),
                @Index(name = "idx_user_notifications_recipient_status", columnList = "recipient_user_id,status"),
                @Index(name = "idx_user_notifications_recipient_scope", columnList = "recipient_user_id,scope"),
                @Index(name = "idx_user_notifications_deleted_at", columnList = "deleted_at")
        }
)
public class UserNotification {

    public static final String SCOPE_PERSONAL = "personal";
    public static final String SCOPE_SYSTEM = "system";
    public static final String STATUS_UNREAD = "unread";
    public static final String STATUS_READ = "read";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private UserAccount recipientUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_user_id")
    private UserAccount senderUser;

    @Column(nullable = false, length = 20)
    private String scope = SCOPE_PERSONAL;

    @Column(nullable = false, length = 120)
    private String type;

    @Column(nullable = false, length = 120)
    private String module;

    @Column(name = "module_key", length = 120)
    private String moduleKey;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false, length = 20)
    private String priority = "medium";

    @Column(nullable = false, length = 20)
    private String status = STATUS_UNREAD;

    @Column(name = "action_url", length = 512)
    private String actionUrl;

    @Column(name = "related_entity_type", length = 80)
    private String relatedEntityType;

    @Column(name = "related_entity_id")
    private UUID relatedEntityId;

    @Column(name = "related_entity_number", length = 120)
    private String relatedEntityNumber;

    @Column(name = "related_entity_title", length = 255)
    private String relatedEntityTitle;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private JsonNode metadata;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** Set once {@link com.eqms.service.NotificationEscalationScheduler} has escalated this
     * unread notification, so the periodic scan never escalates the same one twice. */
    @Column(name = "escalated_at")
    private Instant escalatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (scope == null) {
            scope = SCOPE_PERSONAL;
        }
        if (priority == null) {
            priority = "medium";
        }
        if (status == null) {
            status = STATUS_UNREAD;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UserAccount getRecipientUser() {
        return recipientUser;
    }

    public void setRecipientUser(UserAccount recipientUser) {
        this.recipientUser = recipientUser;
    }

    public UserAccount getSenderUser() {
        return senderUser;
    }

    public void setSenderUser(UserAccount senderUser) {
        this.senderUser = senderUser;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getModule() {
        return module;
    }

    public void setModule(String module) {
        this.module = module;
    }

    public String getModuleKey() {
        return moduleKey;
    }

    public void setModuleKey(String moduleKey) {
        this.moduleKey = moduleKey;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getActionUrl() {
        return actionUrl;
    }

    public void setActionUrl(String actionUrl) {
        this.actionUrl = actionUrl;
    }

    public String getRelatedEntityType() {
        return relatedEntityType;
    }

    public void setRelatedEntityType(String relatedEntityType) {
        this.relatedEntityType = relatedEntityType;
    }

    public UUID getRelatedEntityId() {
        return relatedEntityId;
    }

    public void setRelatedEntityId(UUID relatedEntityId) {
        this.relatedEntityId = relatedEntityId;
    }

    public String getRelatedEntityNumber() {
        return relatedEntityNumber;
    }

    public void setRelatedEntityNumber(String relatedEntityNumber) {
        this.relatedEntityNumber = relatedEntityNumber;
    }

    public String getRelatedEntityTitle() {
        return relatedEntityTitle;
    }

    public void setRelatedEntityTitle(String relatedEntityTitle) {
        this.relatedEntityTitle = relatedEntityTitle;
    }

    public JsonNode getMetadata() {
        return metadata;
    }

    public void setMetadata(JsonNode metadata) {
        this.metadata = metadata;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant readAt) {
        this.readAt = readAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public Instant getEscalatedAt() {
        return escalatedAt;
    }

    public void setEscalatedAt(Instant escalatedAt) {
        this.escalatedAt = escalatedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
