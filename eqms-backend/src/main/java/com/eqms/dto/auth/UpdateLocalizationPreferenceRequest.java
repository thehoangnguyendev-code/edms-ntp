package com.eqms.dto.auth;

import jakarta.validation.constraints.Pattern;

public record UpdateLocalizationPreferenceRequest(
        boolean useSystemDefaults,
        String language,
        String dateTimeFormat,
        String timeZone,
        String numberFormat,
        @Pattern(regexp = "^(INTER|GOOGLE_SANS|GOOGLE_SANS_FLEX|PLUS_JAKARTA_SANS|COMFORTAA|QUESTRIAL|GOWUN_BATANG|TIKTOK_SANS)$", message = "Unsupported application font")
        String fontFamily
) {}
