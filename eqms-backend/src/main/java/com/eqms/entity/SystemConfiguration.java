package com.eqms.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "system_configurations")
public class SystemConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "config_key", nullable = false, unique = true)
    private String configKey = "default";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "general_config", nullable = false, columnDefinition = "jsonb")
    private JsonNode generalConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "security_config", nullable = false, columnDefinition = "jsonb")
    private JsonNode securityConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "documents_config", nullable = false, columnDefinition = "jsonb")
    private JsonNode documentsConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "notifications_config", nullable = false, columnDefinition = "jsonb")
    private JsonNode notificationsConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "integrations_config", nullable = false, columnDefinition = "jsonb")
    private JsonNode integrationsConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "features_config", nullable = false, columnDefinition = "jsonb")
    private JsonNode featuresConfig;

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

    public String getConfigKey() {
        return configKey;
    }

    public void setConfigKey(String configKey) {
        this.configKey = configKey;
    }

    public JsonNode getGeneralConfig() {
        return generalConfig;
    }

    public void setGeneralConfig(JsonNode generalConfig) {
        this.generalConfig = generalConfig;
    }

    public JsonNode getSecurityConfig() {
        return securityConfig;
    }

    public void setSecurityConfig(JsonNode securityConfig) {
        this.securityConfig = securityConfig;
    }

    public JsonNode getDocumentsConfig() {
        return documentsConfig;
    }

    public void setDocumentsConfig(JsonNode documentsConfig) {
        this.documentsConfig = documentsConfig;
    }

    public JsonNode getNotificationsConfig() {
        return notificationsConfig;
    }

    public void setNotificationsConfig(JsonNode notificationsConfig) {
        this.notificationsConfig = notificationsConfig;
    }

    public JsonNode getIntegrationsConfig() {
        return integrationsConfig;
    }

    public void setIntegrationsConfig(JsonNode integrationsConfig) {
        this.integrationsConfig = integrationsConfig;
    }

    public JsonNode getFeaturesConfig() {
        return featuresConfig;
    }

    public void setFeaturesConfig(JsonNode featuresConfig) {
        this.featuresConfig = featuresConfig;
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
