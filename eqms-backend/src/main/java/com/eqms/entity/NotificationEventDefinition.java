package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Catalog of every notifiable event in the system — "what can happen" (Document Control,
 * Controlled Copies, CAPA, Deviation, Audit Trail, Security, System). Seeded by
 * NotificationEventCatalogBootstrap; business modules reference an event by its stable {@link
 * #code} when dispatching, never by hardcoding recipient/content logic themselves.
 */
@Entity
@Table(name = "notification_event_definitions")
public class NotificationEventDefinition {

    public static final String PRIORITY_LOW = "LOW";
    public static final String PRIORITY_MEDIUM = "MEDIUM";
    public static final String PRIORITY_HIGH = "HIGH";
    public static final String PRIORITY_CRITICAL = "CRITICAL";

    public static final String COMPLIANCE_GMP_MANDATORY = "GMP_MANDATORY";
    public static final String COMPLIANCE_COMPLIANCE = "COMPLIANCE";
    public static final String COMPLIANCE_OPTIONAL = "OPTIONAL";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 60)
    private String module;

    @Column(nullable = false, length = 20)
    private String priority = PRIORITY_MEDIUM;

    @Column(name = "compliance_group", nullable = false, length = 30)
    private String complianceGroup = COMPLIANCE_OPTIONAL;

    @Column(name = "related_action", length = 120)
    private String relatedAction;

    @Column(name = "data_object", length = 120)
    private String dataObject;

    /** Comma-separated: IN_APP, EMAIL, ESCALATION */
    @Column(name = "supported_channels", nullable = false, length = 120)
    private String supportedChannels = "IN_APP";

    /** Comma-separated list of {{variable}} names valid for this event's templates. */
    @Column(name = "available_variables", length = 1000)
    private String availableVariables;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory = false;

    @Column(name = "mandatory_reason", length = 500)
    private String mandatoryReason;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "display_order", nullable = false)
    private int displayOrder = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getComplianceGroup() { return complianceGroup; }
    public void setComplianceGroup(String complianceGroup) { this.complianceGroup = complianceGroup; }
    public String getRelatedAction() { return relatedAction; }
    public void setRelatedAction(String relatedAction) { this.relatedAction = relatedAction; }
    public String getDataObject() { return dataObject; }
    public void setDataObject(String dataObject) { this.dataObject = dataObject; }
    public String getSupportedChannels() { return supportedChannels; }
    public void setSupportedChannels(String supportedChannels) { this.supportedChannels = supportedChannels; }
    public String getAvailableVariables() { return availableVariables; }
    public void setAvailableVariables(String availableVariables) { this.availableVariables = availableVariables; }
    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
    public String getMandatoryReason() { return mandatoryReason; }
    public void setMandatoryReason(String mandatoryReason) { this.mandatoryReason = mandatoryReason; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
