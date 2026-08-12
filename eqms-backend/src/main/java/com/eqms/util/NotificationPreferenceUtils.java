package com.eqms.util;

import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class NotificationPreferenceUtils {

    public static final String CHANNEL_EMAIL = "email";
    public static final String CHANNEL_IN_APP = "inApp";
    public static final String CHANNEL_PUSH = "push";

    public static final String MODULE_DOCUMENT = "document";
    public static final String MODULE_CONTROLLED_COPY = "controlled-copies";
    public static final String MODULE_TRAINING = "training";
    public static final String MODULE_CAPA = "capa";
    public static final String MODULE_DEVIATION = "deviation";
    public static final String MODULE_CHANGE_CONTROL = "change-control";
    public static final String MODULE_SYSTEM = "system";

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private static final Map<String, Boolean> DEFAULT_CHANNELS = Map.of(
            CHANNEL_EMAIL, Boolean.TRUE,
            CHANNEL_IN_APP, Boolean.TRUE,
            CHANNEL_PUSH, Boolean.FALSE
    );

    private static final Map<String, Boolean> DEFAULT_MODULES = Map.ofEntries(
            Map.entry(MODULE_DOCUMENT, Boolean.TRUE),
            Map.entry(MODULE_CONTROLLED_COPY, Boolean.TRUE),
            Map.entry(MODULE_TRAINING, Boolean.TRUE),
            Map.entry(MODULE_CAPA, Boolean.TRUE),
            Map.entry(MODULE_DEVIATION, Boolean.TRUE),
            Map.entry(MODULE_CHANGE_CONTROL, Boolean.TRUE),
            Map.entry(MODULE_SYSTEM, Boolean.TRUE)
    );

    private NotificationPreferenceUtils() {
    }

    public static Map<String, Object> defaultPreferences() {
        Map<String, Object> preferences = new LinkedHashMap<>();
        preferences.put("channels", new LinkedHashMap<>(DEFAULT_CHANNELS));
        preferences.put("modules", new LinkedHashMap<>(DEFAULT_MODULES));
        return preferences;
    }

    public static Map<String, Object> normalizePreferences(Map<String, Object> preferences) {
        Map<String, Object> normalized = defaultPreferences();
        if (preferences == null || preferences.isEmpty()) {
            return normalized;
        }

        Map<String, Object> channels = asMap(preferences.get("channels"));
        if (channels != null) {
            Map<String, Object> normalizedChannels = asMap(normalized.get("channels"));
            channels.forEach((key, value) -> {
                String normalizedKey = normalizeKey(key);
                if (normalizedChannels.containsKey(normalizedKey) && value instanceof Boolean boolValue) {
                    normalizedChannels.put(normalizedKey, boolValue);
                }
            });
        }

        Map<String, Object> modules = asMap(preferences.get("modules"));
        if (modules != null) {
            Map<String, Object> normalizedModules = asMap(normalized.get("modules"));
            modules.forEach((key, value) -> {
                String normalizedKey = normalizeModuleKey(key);
                if (normalizedModules.containsKey(normalizedKey) && value instanceof Boolean boolValue) {
                    normalizedModules.put(normalizedKey, boolValue);
                }
            });
        }

        return normalized;
    }

    public static Map<String, Object> parsePreferences(ObjectMapper objectMapper, String json) {
        if (!StringUtils.hasText(json)) {
            return defaultPreferences();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(json, MAP_TYPE);
            return normalizePreferences(parsed);
        } catch (Exception ignored) {
            return defaultPreferences();
        }
    }

    public static String serializePreferences(ObjectMapper objectMapper, Map<String, Object> preferences) {
        try {
            return objectMapper.writeValueAsString(normalizePreferences(preferences));
        } catch (Exception ignored) {
            return null;
        }
    }

    public static boolean canReceiveInAppNotification(ObjectMapper objectMapper, UserAccount user, String module) {
        return isChannelEnabled(objectMapper, user, CHANNEL_IN_APP) && isModuleEnabled(objectMapper, user, module);
    }

    public static boolean canReceiveEmailNotification(ObjectMapper objectMapper, UserAccount user, String module) {
        return isChannelEnabled(objectMapper, user, CHANNEL_EMAIL) && isModuleEnabled(objectMapper, user, module);
    }

    public static boolean isChannelEnabled(ObjectMapper objectMapper, UserAccount user, String channelKey) {
        if (user == null) {
            return false;
        }
        String normalizedKey = normalizeKey(channelKey);
        if (CHANNEL_EMAIL.equals(normalizedKey)) {
            return user.isEmailNotificationsEnabled();
        }
        Map<String, Object> preferences = parsePreferences(objectMapper, user.getNotificationPreferences());
        Map<String, Object> channels = asMap(preferences.get("channels"));
        if (channels == null) {
            return DEFAULT_CHANNELS.getOrDefault(normalizedKey, Boolean.TRUE);
        }
        Object value = channels.get(normalizedKey);
        if (value instanceof Boolean boolValue) {
            return boolValue;
        }
        return DEFAULT_CHANNELS.getOrDefault(normalizedKey, Boolean.TRUE);
    }

    public static boolean isModuleEnabled(ObjectMapper objectMapper, UserAccount user, String module) {
        if (user == null) {
            return false;
        }
        String normalizedModule = normalizeModuleKey(module);
        if (!StringUtils.hasText(normalizedModule)) {
            return true;
        }
        Map<String, Object> preferences = parsePreferences(objectMapper, user.getNotificationPreferences());
        Map<String, Object> modules = asMap(preferences.get("modules"));
        if (modules == null) {
            return DEFAULT_MODULES.getOrDefault(normalizedModule, Boolean.TRUE);
        }
        Object value = modules.get(normalizedModule);
        if (value instanceof Boolean boolValue) {
            return boolValue;
        }
        return DEFAULT_MODULES.getOrDefault(normalizedModule, Boolean.TRUE);
    }

    public static String normalizeModuleKey(String module) {
        if (!StringUtils.hasText(module)) {
            return MODULE_SYSTEM;
        }
        return module.trim().toLowerCase(Locale.ROOT).replace(' ', '-').replace('_', '-');
    }

    private static String normalizeKey(String key) {
        if (!StringUtils.hasText(key)) {
            return key;
        }
        return key.trim();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                if (k != null) {
                    result.put(String.valueOf(k), v);
                }
            });
            return result;
        }
        return null;
    }
}
