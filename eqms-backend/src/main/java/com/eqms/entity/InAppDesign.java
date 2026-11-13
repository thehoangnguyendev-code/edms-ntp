package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** The one look every toast (system message) of the application shares: colour, shadow, place and display time. There is exactly one row. */
@Entity
@Table(name = "in_app_design")
public class InAppDesign {

    @Id
    private UUID id;

    @Column(name = "toast_position", nullable = false, length = 20)
    private String toastPosition = "top-right";

    @Column(name = "toast_duration_seconds", nullable = false)
    private int toastDurationSeconds = 5;

    @Column(name = "toast_color", nullable = false, length = 7)
    private String toastColor = "#3B82F6";

    @Column(name = "toast_shadow", nullable = false)
    private int toastShadow = 40;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getToastPosition() { return toastPosition; }
    public void setToastPosition(String toastPosition) { this.toastPosition = toastPosition; }
    public int getToastDurationSeconds() { return toastDurationSeconds; }
    public void setToastDurationSeconds(int toastDurationSeconds) { this.toastDurationSeconds = toastDurationSeconds; }
    public String getToastColor() { return toastColor; }
    public void setToastColor(String toastColor) { this.toastColor = toastColor; }
    public int getToastShadow() { return toastShadow; }
    public void setToastShadow(int toastShadow) { this.toastShadow = toastShadow; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
