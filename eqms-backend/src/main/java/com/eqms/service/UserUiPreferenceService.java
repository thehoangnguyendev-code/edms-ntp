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

    private static final Map<String, Consumer<JsonNode>> VALIDATORS = Map.of(
            NOTIFICATION_DOCK, UserUiPreferenceService::validateNotificationDock
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
