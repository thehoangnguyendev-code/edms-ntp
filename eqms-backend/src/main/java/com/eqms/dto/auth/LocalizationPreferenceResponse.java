package com.eqms.dto.auth;

public record LocalizationPreferenceResponse(
        boolean useSystemDefaults,
        String language,
        String dateTimeFormat,
        String timeZone,
        String numberFormat,
        String fontFamily
) {}
