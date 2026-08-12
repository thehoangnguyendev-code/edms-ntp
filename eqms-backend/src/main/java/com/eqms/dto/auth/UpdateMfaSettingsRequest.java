package com.eqms.dto.auth;

public record UpdateMfaSettingsRequest(
        Boolean mfaEmailFallbackEnabled,
        Boolean mfaRememberDeviceEnabled
) {
}
