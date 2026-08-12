package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_localization_preferences")
public class UserLocalizationPreference {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private UserAccount user;

    @Column(name = "use_system_defaults", nullable = false)
    private boolean useSystemDefaults = true;

    @Column(length = 32)
    private String language;

    @Column(name = "date_time_format", length = 64)
    private String dateTimeFormat;

    @Column(name = "time_zone", length = 64)
    private String timeZone;

    @Column(name = "number_format", length = 32)
    private String numberFormat;

    @Column(name = "font_family", length = 32)
    private String fontFamily;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public boolean isUseSystemDefaults() { return useSystemDefaults; }
    public void setUseSystemDefaults(boolean value) { this.useSystemDefaults = value; }
    public String getLanguage() { return language; }
    public void setLanguage(String value) { this.language = value; }
    public String getDateTimeFormat() { return dateTimeFormat; }
    public void setDateTimeFormat(String value) { this.dateTimeFormat = value; }
    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String value) { this.timeZone = value; }
    public String getNumberFormat() { return numberFormat; }
    public void setNumberFormat(String value) { this.numberFormat = value; }
    public String getFontFamily() { return fontFamily; }
    public void setFontFamily(String value) { this.fontFamily = value; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant value) { this.updatedAt = value; }
}
