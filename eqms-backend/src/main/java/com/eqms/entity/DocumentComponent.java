package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A reusable token that can be dropped into a {@link DocumentNameFormat} (Document Name Formats
 * screen) — e.g. "Document Type Code", "Serial Number", "Department Code". Mirrors the
 * ServiceNow-style "Document Component" catalog: a CLOSED, developer-curated list of what data a
 * name format is allowed to expose, not an open field picker.
 *
 * GMP/security boundary (Decision Log, Document Name Formats plan): {@code sourceTable}/
 * {@code sourceField} identify which already-existing domain field a component resolves to, and
 * are set ONLY by the seed data below / future backend changes — never editable via the admin
 * API. Admins may only create components of type {@code FREE_TEXT} (a literal static string with
 * no access to system data), and may re-order/activate the seeded field-bound components. This
 * prevents a name format from being used to leak a field never meant to appear in a document's
 * public identifier.
 */
@Entity
@Table(name = "document_components")
public class DocumentComponent {

    /** A component whose value comes from a real domain field, resolved by a backend whitelist. */
    public static final String SOURCE_DOCUMENT = "DOCUMENT";
    public static final String SOURCE_REVISION = "REVISION";
    public static final String SOURCE_USER = "USER";
    /** A component whose value is the literal {@code freeText} string — no system data involved. */
    public static final String SOURCE_FREE_TEXT = "FREE_TEXT";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    /** Token key used to reference this component (e.g. "documentType", "serial_number"). */
    @Column(nullable = false, unique = true, length = 80)
    private String value;

    @Column(name = "short_description", length = 512)
    private String shortDescription;

    /** One of the SOURCE_* constants above. */
    @Column(name = "source_table", nullable = false, length = 20)
    private String sourceTable;

    /** The specific field this component resolves to (e.g. "DocumentType.shortCode"); null for FREE_TEXT. */
    @Column(name = "source_field", length = 120)
    private String sourceField;

    /** The literal value this component renders when sourceTable = FREE_TEXT; null otherwise. */
    @Column(name = "free_text", length = 120)
    private String freeText;

    /** Whether an admin created this row (FREE_TEXT only) vs. it being backend-seeded. */
    @Column(name = "is_system_defined", nullable = false)
    private boolean systemDefined;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public String getShortDescription() {
        return shortDescription;
    }

    public void setShortDescription(String shortDescription) {
        this.shortDescription = shortDescription;
    }

    public String getSourceTable() {
        return sourceTable;
    }

    public void setSourceTable(String sourceTable) {
        this.sourceTable = sourceTable;
    }

    public String getSourceField() {
        return sourceField;
    }

    public void setSourceField(String sourceField) {
        this.sourceField = sourceField;
    }

    public String getFreeText() {
        return freeText;
    }

    public void setFreeText(String freeText) {
        this.freeText = freeText;
    }

    public boolean isSystemDefined() {
        return systemDefined;
    }

    public void setSystemDefined(boolean systemDefined) {
        this.systemDefined = systemDefined;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(int displayOrder) {
        this.displayOrder = displayOrder;
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
