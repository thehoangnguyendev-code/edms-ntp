package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** The Audit Trail of a configuration save lists the settings that changed, one row each, and never prints a picture or a whole section. */
class SystemConfigurationAuditChangesTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private Map<String, String> flat(String json) throws Exception {
        Map<String, String> out = new LinkedHashMap<>();
        SystemConfigurationService.flattenForAudit("", JSON.readTree(json), out);
        return out;
    }

    @Test
    void settingsArePathsAndAPictureIsOnlyFingerprinted() throws Exception {
        var out = flat("{\"appearance\":{\"primaryColor\":\"emerald\"},\"auth\":{\"image\":\"data:image/jpeg;base64," + "A".repeat(500) + "\"}}");

        assertThat(out.get("appearance.primaryColor")).isEqualTo("emerald");
        assertThat(out.get("auth.image")).startsWith("[image/jpeg, ").contains("sha256:").doesNotContain("AAAA");
    }

    @Test
    void listsWithIdsAreComparedItemByItemAndOtherListsAreOneValue() throws Exception {
        var out = flat("{\"features\":[{\"id\":\"feat-a\",\"enabled\":true},{\"id\":\"feat-b\",\"enabled\":false}],\"days\":[1,2]}");

        assertThat(out).containsEntry("features[feat-a].enabled", "true").containsEntry("features[feat-b].enabled", "false").containsEntry("days", "[1,2]");
    }

    @Test
    void pathsReadAsWords() {
        assertThat(SystemConfigurationService.humanizeAuditPath("appearance.primaryColor")).isEqualTo("Appearance > Primary Color");
        assertThat(SystemConfigurationService.humanizeAuditPath("features[feat-a].enabled")).isEqualTo("Features [feat-a] > Enabled");
    }
}
