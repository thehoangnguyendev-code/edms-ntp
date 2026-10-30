package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PageBackgroundConfigurationTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void acceptsDefaultsAndSupportedModes() throws Exception {
        assertDoesNotThrow(() -> SystemConfigurationService.validatePageBackgrounds(json.readTree("{}")));
        for (String mode : new String[]{"default", "solid", "linear", "radial", "conic"}) {
            var config = json.readTree("{\"appearance\":{\"mainBackground\":{\"mode\":\"" + mode + "\",\"colors\":[\"#F8FAFC\",\"#aabbCC\"],\"angle\":135}}}");
            assertDoesNotThrow(() -> SystemConfigurationService.validatePageBackgrounds(config));
        }
    }

    @Test void rejectsUntrustedCssInvalidAnglesAndTooManyColors() throws Exception {
        for (String value : new String[]{
                "{\"mode\":\"linear\",\"colors\":[\"#fff\",\"#123456\"],\"angle\":0}",
                "{\"mode\":\"url(evil)\",\"colors\":[\"#123456\",\"#123456\"],\"angle\":0}",
                "{\"mode\":\"linear\",\"colors\":[\"#123456\",\"#123456\"],\"angle\":361}",
                "{\"mode\":\"linear\",\"colors\":[\"#123456\",\"#123456\",\"#123456\",\"#123456\",\"#123456\",\"#123456\"],\"angle\":0}"}) {
            var config = json.readTree("{\"appearance\":{\"authBackground\":" + value + "}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validatePageBackgrounds(config));
        }
    }

    @Test void validatesExtendedBackgrounds() throws Exception {
        var valid = json.readTree("{\"appearance\":{\"authBackground\":{\"mode\":\"image\",\"colors\":[\"#ffffff\",\"#000000\"],\"angle\":0,\"image\":\"data:image/png;base64,aGVsbG8=\",\"imageFit\":\"cover\",\"overlayColor\":\"#ffffff\",\"overlayOpacity\":30,\"stops\":[0,100],\"centerX\":20}}}");
        assertDoesNotThrow(() -> SystemConfigurationService.validatePageBackgrounds(valid));
        for (String extension : new String[]{"\"stops\":[90,10]", "\"centerX\":101", "\"image\":\"https://evil.example/image.png\""}) {
            var invalid = json.readTree("{\"appearance\":{\"authBackground\":{\"mode\":\"linear\",\"colors\":[\"#ffffff\",\"#000000\"],\"angle\":0," + extension + "}}}");
            assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validatePageBackgrounds(invalid));
        }
    }

    @Test void onlyAuthenticationCanUseAValidVideoReference() throws Exception {
        String data = "{\"mode\":\"video\",\"colors\":[\"#ffffff\",\"#000000\"],\"angle\":0,\"videoId\":\"00000000-0000-0000-0000-000000000001\",\"videoLoop\":true}";
        assertDoesNotThrow(() -> SystemConfigurationService.validatePageBackgrounds(json.readTree("{\"appearance\":{\"authBackground\":" + data + "}}")));
        assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validatePageBackgrounds(json.readTree("{\"appearance\":{\"mainBackground\":" + data + "}}")));
        assertThrows(IllegalArgumentException.class, () -> SystemConfigurationService.validatePageBackgrounds(json.readTree("{\"appearance\":{\"authBackground\":" + data.replace("00000000-0000-0000-0000-000000000001", "../bad") + "}}")));
    }
}
