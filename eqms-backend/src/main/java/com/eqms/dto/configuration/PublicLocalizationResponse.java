package com.eqms.dto.configuration;

/** System-wide display settings that are safe to expose without authentication. */
public record PublicLocalizationResponse(
        String language,
        String dateTimeFormat,
        String timeZone,
        String numberFormat
) {
}
