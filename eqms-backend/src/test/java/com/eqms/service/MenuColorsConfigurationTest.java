package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Appearance > Dropdown Menus: the text and icon colours of the dropdown menu items. */
class MenuColorsConfigurationTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    private static JsonNode general(String appearance) throws Exception {
        return JSON.readTree("{\"appearance\":" + appearance + "}");
    }

    @Test
    void anEmptyOrMissingColourIsAcceptedAndMeansTheBuiltInColour() throws Exception {
        assertThatCode(() -> SystemConfigurationService.validateMenuColors(general("{}"))).doesNotThrowAnyException();
        assertThatCode(() -> SystemConfigurationService.validateMenuColors(general("{\"menuTextColor\":\"\",\"menuIconColor\":null}"))).doesNotThrowAnyException();
        assertThatCode(() -> SystemConfigurationService.validateMenuColors(null)).doesNotThrowAnyException();
    }

    @Test
    void aSixDigitHexColourIsAccepted() throws Exception {
        assertThatCode(() -> SystemConfigurationService.validateMenuColors(general("{\"menuTextColor\":\"#1E293B\",\"menuIconColor\":\"#0f766e\"}"))).doesNotThrowAnyException();
    }

    @Test
    void anythingElseIsRefusedSoNoStyleCanBeInjectedIntoEveryPage() throws Exception {
        for (String bad : new String[] {"\"red\"", "\"#fff\"", "\"#GGGGGG\"", "\"#123456; background:url(x)\"", "\"url(javascript:1)\"", "12", "true"}) {
            JsonNode node = general("{\"menuTextColor\":" + bad + "}");
            assertThatThrownBy(() -> SystemConfigurationService.validateMenuColors(node)).as(bad).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> SystemConfigurationService.validateMenuColors(general("{\"menuIconColor\":\"blue\"}")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("menuIconColor");
    }

    @Test
    void thePublicBrandingCarriesOnlyAValidColourOtherwiseNull() throws Exception {
        assertThat(SystemConfigurationService.optionalHexColor(general("{\"menuTextColor\":\"#1E293B\"}").get("appearance"), "menuTextColor")).isEqualTo("#1E293B");
        assertThat(SystemConfigurationService.optionalHexColor(general("{\"menuTextColor\":\"\"}").get("appearance"), "menuTextColor")).isNull();
        assertThat(SystemConfigurationService.optionalHexColor(general("{\"menuTextColor\":\"red\"}").get("appearance"), "menuTextColor")).isNull();
        assertThat(SystemConfigurationService.optionalHexColor(null, "menuTextColor")).isNull();
    }
}
