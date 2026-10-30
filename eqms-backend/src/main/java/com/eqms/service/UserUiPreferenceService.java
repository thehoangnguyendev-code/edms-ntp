package com.eqms.service;

import com.eqms.entity.UserUiPreference;
import com.eqms.repository.UserUiPreferenceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Stores each user's own interface preferences so they follow the user to any browser. The controller always passes the
 * authenticated user id, so a user can only read or write their own rows. Only the keys listed in {@link #VALIDATORS} exist,
 * each with a value shape that is checked on every write; anything else is refused rather than stored.
 */
@Service
public class UserUiPreferenceService {

    /** The notification list pinned to the side of the layout: {@code {"pinned": true|false}}. */
    public static final String NOTIFICATION_DOCK = "notification-dock";

    /** The menu entries the user starred in the sidebar: {@code {"ids": ["menu-id", ...]}}, in the order they were starred. */
    public static final String SIDEBAR_FAVORITES = "sidebar-favorites";
    public static final String DASHBOARD_LAYOUT = "dashboard-layout";
    static final int MAX_FAVORITES = 200;
    static final int MAX_FAVORITE_ID_LENGTH = 100;

    private static final Map<String, Consumer<JsonNode>> VALIDATORS = Map.of(
            NOTIFICATION_DOCK, UserUiPreferenceService::validateNotificationDock,
            SIDEBAR_FAVORITES, UserUiPreferenceService::validateSidebarFavorites,
            DASHBOARD_LAYOUT, UserUiPreferenceService::validateDashboardLayout
    );

    private final UserUiPreferenceRepository repository;
    private final ObjectMapper objectMapper;

    public UserUiPreferenceService(UserUiPreferenceRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /** The saved value, or empty when the user never changed this preference. */
    @Transactional(readOnly = true)
    public Optional<JsonNode> find(UUID userId, String key) {
        requireKnownKey(key);
        return repository.findByUserIdAndPrefKey(userId, key).map(row -> parseStored(row.getValue()));
    }

    @Transactional
    public JsonNode save(UUID userId, String key, JsonNode value) {
        requireKnownKey(key);
        VALIDATORS.get(key).accept(value);
        UserUiPreference row = repository.findByUserIdAndPrefKey(userId, key).orElseGet(() -> {
            UserUiPreference created = new UserUiPreference();
            created.setId(UUID.randomUUID());
            created.setUserId(userId);
            created.setPrefKey(key);
            return created;
        });
        row.setValue(value.toString());
        row.setUpdatedAt(Instant.now());
        repository.save(row);
        return value;
    }

    @Transactional
    public void reset(UUID userId, String key) {
        requireKnownKey(key);
        repository.findByUserIdAndPrefKey(userId, key).ifPresent(repository::delete);
    }

    static void validateNotificationDock(JsonNode value) {
        if (value == null || !value.isObject()) {
            throw new IllegalArgumentException("The notification dock preference must be a JSON object");
        }
        value.fieldNames().forEachRemaining(field -> {
            if (!"pinned".equals(field)) {
                throw new IllegalArgumentException("Unknown notification dock setting: " + field);
            }
        });
        JsonNode pinned = value.get("pinned");
        if (pinned == null || !pinned.isBoolean()) {
            throw new IllegalArgumentException("The notification dock setting 'pinned' must be true or false");
        }
    }

    static void validateSidebarFavorites(JsonNode value) {
        if (value == null || !value.isObject()) {
            throw new IllegalArgumentException("The sidebar favourites preference must be a JSON object");
        }
        value.fieldNames().forEachRemaining(field -> {
            if (!"ids".equals(field)) {
                throw new IllegalArgumentException("Unknown sidebar favourites setting: " + field);
            }
        });
        JsonNode ids = value.get("ids");
        if (ids == null || !ids.isArray() || ids.size() > MAX_FAVORITES) {
            throw new IllegalArgumentException("The sidebar favourites 'ids' must be a list of at most " + MAX_FAVORITES + " menu ids");
        }
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (JsonNode id : ids) {
            if (!id.isTextual() || id.asText().isBlank() || id.asText().length() > MAX_FAVORITE_ID_LENGTH || !seen.add(id.asText())) {
                throw new IllegalArgumentException("Each sidebar favourite must be a distinct, non-blank menu id of at most " + MAX_FAVORITE_ID_LENGTH + " characters");
            }
        }
    }

    /** Layout preferences never grant access to a widget or its data. */
    static void validateDashboardLayout(JsonNode value) {
        if (value == null || !value.isObject()) throw new IllegalArgumentException("Dashboard layout must be an object");
        value.fieldNames().forEachRemaining(field -> {
            if (!"widgets".equals(field)) throw new IllegalArgumentException("Unknown dashboard layout setting: " + field);
        });
        JsonNode widgets = value.get("widgets");
        if (widgets == null || !widgets.isArray() || widgets.size() > 30) throw new IllegalArgumentException("Dashboard widgets must be a list of at most 30 items");
        var seen = new java.util.HashSet<String>();
        for (JsonNode widget : widgets) {
            if (!widget.isObject()) throw new IllegalArgumentException("Invalid dashboard widget");
            widget.fieldNames().forEachRemaining(field -> {
                if (!java.util.Set.of("id", "visible", "width").contains(field)) throw new IllegalArgumentException("Unknown widget setting: " + field);
            });
            JsonNode id = widget.get("id"), visible = widget.get("visible"), width = widget.get("width");
            if (id == null || !id.isTextual() || !java.util.Set.of("user-kpis", "admin-kpis", "audit-activity", "revision-pipeline", "effective-by-type", "documents-by-status", "system-monitoring", "pending-work", "document-activity", "workflow-pipeline", "my-documents").contains(id.asText()) || !seen.add(id.asText())) throw new IllegalArgumentException("Invalid or duplicate widget ID");
            if (visible == null || !visible.isBoolean()) throw new IllegalArgumentException("Widget visibility must be true or false");
            if (width == null || !width.isTextual() || !java.util.Set.of("half", "full").contains(width.asText())) throw new IllegalArgumentException("Invalid widget width");
        }
    }

    private static void requireKnownKey(String key) {
        if (key == null || !VALIDATORS.containsKey(key)) {
            throw new IllegalArgumentException("Unknown interface preference");
        }
    }

    private JsonNode parseStored(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            // A corrupt row must not break the screen; the client then keeps its default.
            return objectMapper.createObjectNode();
        }
    }
}
