package com.eqms.service;

import com.eqms.entity.UserTablePreference;
import com.eqms.repository.UserTablePreferenceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Stores each user's own column layout for a data table. The controller always passes the
 * authenticated user id, so a user can only read or write their own row.
 */
@Service
public class UserTablePreferenceService {

    private static final Pattern TABLE_KEY = Pattern.compile("^[a-z0-9._-]{1,120}$");
    private static final int MAX_COLUMNS = 100;
    private static final int MAX_ID_LENGTH = 80;

    private final UserTablePreferenceRepository repository;
    private final ObjectMapper objectMapper;

    public UserTablePreferenceService(UserTablePreferenceRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Optional<JsonNode> find(UUID userId, String tableKey) {
        requireValidKey(tableKey);
        return repository.findByUserIdAndTableKey(userId, tableKey)
                .map(row -> parseStored(row.getPreferences()));
    }

    @Transactional
    public JsonNode save(UUID userId, String tableKey, JsonNode preferences) {
        requireValidKey(tableKey);
        validate(preferences);
        UserTablePreference row = repository.findByUserIdAndTableKey(userId, tableKey).orElseGet(() -> {
            UserTablePreference created = new UserTablePreference();
            created.setId(UUID.randomUUID());
            created.setUserId(userId);
            created.setTableKey(tableKey);
            return created;
        });
        row.setPreferences(preferences.toString());
        row.setUpdatedAt(Instant.now());
        repository.save(row);
        return preferences;
    }

    @Transactional
    public void reset(UUID userId, String tableKey) {
        requireValidKey(tableKey);
        repository.findByUserIdAndTableKey(userId, tableKey).ifPresent(repository::delete);
    }

    /** Expected shape: [{ "id": "name", "visible": true, "order": 0, "pinned": false }, ...] */
    static void validate(JsonNode preferences) {
        if (preferences == null || !preferences.isArray()) {
            throw new IllegalArgumentException("Column preferences must be a JSON array");
        }
        if (preferences.size() > MAX_COLUMNS) {
            throw new IllegalArgumentException("Too many columns (max " + MAX_COLUMNS + ")");
        }
        Set<String> seen = new HashSet<>();
        for (JsonNode column : preferences) {
            JsonNode id = column.get("id");
            if (id == null || !id.isTextual() || id.asText().isBlank() || id.asText().length() > MAX_ID_LENGTH) {
                throw new IllegalArgumentException("Each column needs a text id of up to " + MAX_ID_LENGTH + " characters");
            }
            if (!seen.add(id.asText())) {
                throw new IllegalArgumentException("Duplicate column id: " + id.asText());
            }
            JsonNode visible = column.get("visible");
            if (visible == null || !visible.isBoolean()) {
                throw new IllegalArgumentException("Column visible flag must be true or false");
            }
            JsonNode pinned = column.get("pinned");
            if (pinned == null || !pinned.isBoolean()) {
                throw new IllegalArgumentException("Column pinned flag must be true or false");
            }
            JsonNode order = column.get("order");
            if (order == null || !order.canConvertToInt()) {
                throw new IllegalArgumentException("Column order must be an integer");
            }
        }
    }

    private static void requireValidKey(String tableKey) {
        if (tableKey == null || !TABLE_KEY.matcher(tableKey).matches()) {
            throw new IllegalArgumentException("Invalid table key");
        }
    }

    private JsonNode parseStored(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            // A corrupt row must not break the table; the client then shows the default layout.
            return objectMapper.createArrayNode();
        }
    }
}
