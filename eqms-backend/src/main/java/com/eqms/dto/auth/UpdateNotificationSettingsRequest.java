package com.eqms.dto.auth;

import java.util.Map;

public record UpdateNotificationSettingsRequest(
        Boolean emailNotificationsEnabled,
        Map<String, Object> notificationPreferences
) {
}
