package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

/**
 * One {@link DocumentComponent} placed at a specific position inside one {@link DocumentNameFormat}.
 * The join row itself carries the composition order (a component can appear in several formats,
 * at a different position in each).
 */
@Entity
@Table(name = "document_name_format_components",
        uniqueConstraints = @UniqueConstraint(columnNames = {"format_id", "component_id"}))
public class DocumentNameFormatComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "format_id", nullable = false)
    private DocumentNameFormat format;

    @ManyToOne(optional = false)
    @JoinColumn(name = "component_id", nullable = false)
    private DocumentComponent component;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public DocumentNameFormat getFormat() {
        return format;
    }

    public void setFormat(DocumentNameFormat format) {
        this.format = format;
    }

    public DocumentComponent getComponent() {
        return component;
    }

    public void setComponent(DocumentComponent component) {
        this.component = component;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(int displayOrder) {
        this.displayOrder = displayOrder;
    }
}
