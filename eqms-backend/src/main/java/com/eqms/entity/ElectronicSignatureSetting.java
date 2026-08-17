package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "electronic_signature_settings")
public class ElectronicSignatureSetting {

    public static final UUID DEFAULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000138");

    @Id
    private UUID id = DEFAULT_ID;

    @Column(name = "signature_timestamp_format", length = 40)
    private String signatureTimestampFormat;

    @Column(name = "signature_timezone", length = 64)
    private String signatureTimezone;

    @Column(name = "timestamp_format_effective_from", nullable = false)
    private Instant timestampFormatEffectiveFrom;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (id == null) id = DEFAULT_ID;
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (timestampFormatEffectiveFrom == null) timestampFormatEffectiveFrom = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSignatureTimestampFormat() { return signatureTimestampFormat; }
    public void setSignatureTimestampFormat(String signatureTimestampFormat) { this.signatureTimestampFormat = signatureTimestampFormat; }
    public String getSignatureTimezone() { return signatureTimezone; }
    public void setSignatureTimezone(String signatureTimezone) { this.signatureTimezone = signatureTimezone; }
    public Instant getTimestampFormatEffectiveFrom() { return timestampFormatEffectiveFrom; }
    public void setTimestampFormatEffectiveFrom(Instant value) { this.timestampFormatEffectiveFrom = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
