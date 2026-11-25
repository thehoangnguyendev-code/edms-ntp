package com.eqms.service;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class LoadingAppearancePolicyTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void missingSettingsAndUnknownLegacyValuesKeepTheExistingDefaults() throws Exception {
        assertDoesNotThrow(() -> LoadingAppearancePolicy.validate(mapper.readTree("{}")));
        assertDoesNotThrow(() -> LoadingAppearancePolicy.validate(mapper.readTree("{\"appearance\":{\"loadingStyle\":null,\"loadingColor\":null}}")));
        assertEquals("system", LoadingAppearancePolicy.publicStyle(null));
        assertEquals("#059669", LoadingAppearancePolicy.publicColor(null));
        var bad = mapper.readTree("{\"loadingStyle\":\"unknown\",\"loadingColor\":\"url(evil)\"}");
        assertEquals("system", LoadingAppearancePolicy.publicStyle(bad));
        assertEquals("#059669", LoadingAppearancePolicy.publicColor(bad));
    }

    @Test
    void allSupportedIdentifiersAndHexColoursRoundTrip() throws Exception {
        for (String style : LoadingAppearancePolicy.STYLES) {
            var general = mapper.readTree("{\"appearance\":{\"loadingStyle\":\"" + style + "\",\"loadingColor\":\"#a1B2c3\"}}");
            assertDoesNotThrow(() -> LoadingAppearancePolicy.validate(general));
            assertEquals(style, LoadingAppearancePolicy.publicStyle(general.get("appearance")));
            assertEquals("#a1B2c3", LoadingAppearancePolicy.publicColor(general.get("appearance")));
        }
    }

    @Test
    void rejectsArbitraryStylesCodeAndMalformedColours() {
        for (String style : new String[] {"\"unknown\"", "\"RING\"", "true", "1", "[]", "{}", "\"<script>\""}) {
            assertThrows(IllegalArgumentException.class, () -> LoadingAppearancePolicy.validate(mapper.readTree("{\"appearance\":{\"loadingStyle\":" + style + "}}")), style);
        }
        for (String color : new String[] {"\"\"", "\"red\"", "\"#fff\"", "\"#12345678\"", "\"url(evil)\"", "true", "1", "[]", "{}"}) {
            assertThrows(IllegalArgumentException.class, () -> LoadingAppearancePolicy.validate(mapper.readTree("{\"appearance\":{\"loadingColor\":" + color + "}}")), color);
        }
    }
}
