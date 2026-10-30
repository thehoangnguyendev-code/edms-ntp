package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AlternatingRecordConfigurationTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void permitsMissingAndValidSettings() throws Exception {
        assertDoesNotThrow(() -> SystemConfigurationService.validateAlternatingRecordColors(json.readTree("{}")));
        assertDoesNotThrow(() -> SystemConfigurationService.validateAlternatingRecordColors(json.readTree("{\"appearance\":{\"alternatingRecordColors\":true,\"alternatingRecordColor\":\"#aabbCC\"}}")));
    }

    @Test void rejectsInvalidSwitchAndUnsafeColor() throws Exception {
        var invalidSwitch = json.readTree("{\"appearance\":{\"alternatingRecordColors\":\"true\"}}");
        var invalidColor = json.readTree("{\"appearance\":{\"alternatingRecordColor\":\"red; display:none\"}}");
        assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateAlternatingRecordColors(invalidSwitch));
        assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateAlternatingRecordColors(invalidColor));
    }
}
