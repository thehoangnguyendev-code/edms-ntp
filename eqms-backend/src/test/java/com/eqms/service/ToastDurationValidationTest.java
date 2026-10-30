package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ToastDurationValidationTest {
    private static JsonNode general(String seconds) throws Exception {
        return new ObjectMapper().readTree("{\"appearance\":{\"toastDurationSeconds\":" + seconds + "}}");
    }

    @Test
    void aWholeNumberOfSecondsFromTwoToSixtyIsAcceptedAndEmptyMeansTheDefault() throws Exception {
        for (String ok : new String[] {"2", "5", "60", "null"}) assertDoesNotThrow(() -> SystemConfigurationService.validateToastDuration(general(ok)), ok);
        assertDoesNotThrow(() -> SystemConfigurationService.validateToastDuration(new ObjectMapper().readTree("{\"appearance\":{}}")));
    }

    @Test
    void aNumberOutsideTheRangeOrNotWholeIsRefused() throws Exception {
        for (String bad : new String[] {"0", "1", "61", "-3", "2.5", "\"5\""}) {
            JsonNode node = general(bad);
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validateToastDuration(node), bad);
        }
    }
}
