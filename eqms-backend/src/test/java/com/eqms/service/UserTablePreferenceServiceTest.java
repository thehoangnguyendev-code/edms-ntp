package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserTablePreferenceServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode json(String text) throws Exception {
        return mapper.readTree(text);
    }

    @Test
    void acceptsWellFormedLayout() throws Exception {
        JsonNode layout = json("[{\"id\":\"fullName\",\"visible\":true,\"order\":0,\"pinned\":true},"
                + "{\"id\":\"email\",\"visible\":false,\"order\":1,\"pinned\":false}]");
        assertDoesNotThrow(() -> UserTablePreferenceService.validate(layout));
    }

    @Test
    void acceptsEmptyLayoutMeaningDefaults() throws Exception {
        assertDoesNotThrow(() -> UserTablePreferenceService.validate(json("[]")));
    }

    @Test
    void rejectsNonArrayPayload() throws Exception {
        assertThrows(IllegalArgumentException.class,
                () -> UserTablePreferenceService.validate(json("{\"id\":\"email\"}")));
    }

    @Test
    void rejectsDuplicateColumnIds() throws Exception {
        JsonNode layout = json("[{\"id\":\"email\",\"visible\":true,\"order\":0,\"pinned\":false},"
                + "{\"id\":\"email\",\"visible\":true,\"order\":1,\"pinned\":false}]");
        assertThrows(IllegalArgumentException.class, () -> UserTablePreferenceService.validate(layout));
    }

    @Test
    void rejectsMissingOrNonBooleanFlags() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> UserTablePreferenceService.validate(
                json("[{\"id\":\"email\",\"visible\":\"yes\",\"order\":0,\"pinned\":false}]")));
        assertThrows(IllegalArgumentException.class, () -> UserTablePreferenceService.validate(
                json("[{\"id\":\"email\",\"visible\":true,\"order\":0}]")));
    }

    @Test
    void rejectsNonIntegerOrder() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> UserTablePreferenceService.validate(
                json("[{\"id\":\"email\",\"visible\":true,\"order\":\"first\",\"pinned\":false}]")));
    }

    @Test
    void rejectsBlankOrOversizedId() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> UserTablePreferenceService.validate(
                json("[{\"id\":\" \",\"visible\":true,\"order\":0,\"pinned\":false}]")));
        String longId = "x".repeat(81);
        assertThrows(IllegalArgumentException.class, () -> UserTablePreferenceService.validate(
                json("[{\"id\":\"" + longId + "\",\"visible\":true,\"order\":0,\"pinned\":false}]")));
    }
}
