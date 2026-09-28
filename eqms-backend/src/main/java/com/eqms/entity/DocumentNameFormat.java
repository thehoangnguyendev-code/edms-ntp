package com.eqms.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A named, orderable composition of {@link DocumentComponent} tokens joined by {@code separator}
 * — e.g. "Document Type" + "." + "Serial Number" renders "SOP.0007". Phase 1 of the Document Name
 * Formats feature: this screen only manages the catalog; it is not yet wired into the live
 * document-number generator (see the feature plan's Phase 2/3 for that, and the GMP risk notes
 * there on why that wiring is deliberately separate).
 */
@Entity
@Table(name = "document_name_formats")
public class DocumentNameFormat {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    /**
     * Single-character separator inserted between components. Deliberately narrow (see
     * DocumentNameFormatRequest validation) -- DocumentService#resolveParentDocumentNumber counts
     * "." characters to split a document number from its revision suffix; an unrestricted
     * separator could corrupt that parsing once this format is wired into real number generation.
     */
    @Column(nullable = false, length = 10)
    private String separator;

    @Column(length = 512)
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "format", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<DocumentNameFormatComponent> components = new ArrayList<>();

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

    public String getSeparator() {
        return separator;
    }

    public void setSeparator(String separator) {
        this.separator = separator;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
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

    public List<DocumentNameFormatComponent> getComponents() {
        return components;
    }

    public void setComponents(List<DocumentNameFormatComponent> components) {
        this.components = components;
    }
}
