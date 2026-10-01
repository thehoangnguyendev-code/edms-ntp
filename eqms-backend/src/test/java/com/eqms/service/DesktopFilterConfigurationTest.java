package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DesktopFilterConfigurationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void validatesOnlyBooleansAndAcceptsMissingLegacySetting() throws Exception {
        for (String json : new String[] {"{}", "{\"appearance\":{}}",
                "{\"appearance\":{\"compactDesktopFilters\":true}}",
                "{\"appearance\":{\"compactDesktopFilters\":false}}"}) {
            var config = mapper.readTree(json);
            assertDoesNotThrow(() -> SystemConfigurationService.validateDesktopFilterConfig(config));
        }
        for (String value : new String[] {"null", "1", "\"true\"", "[]", "{}"}) {
            var config = mapper.readTree("{\"appearance\":{\"compactDesktopFilters\":" + value + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateDesktopFilterConfig(config));
        }
    }
}
