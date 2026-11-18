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

    /** CONFIGURATION-PAGES-SPLIT-2026-11-17: the changes of one save are grouped by the page of Configuration that shows them; each group becomes one audit record. */
    @Test
    void theChangesOfASaveAreGroupedByThePageThatShowsThem() throws Exception {
        var byPage = new java.util.EnumMap<com.eqms.util.ConfigurationAuditPage, java.util.List<com.eqms.dto.audittrail.AuditTrailChangeResponse>>(com.eqms.util.ConfigurationAuditPage.class);
        SystemConfigurationService.addConfigurationChanges(byPage, "General",
                JSON.readTree("{\"systemDisplayName\":\"A\",\"navigationLabelOverrides\":{\"doc-all\":\"Docs\"},\"backupSettings\":{\"onlyOffice\":{\"documentServerUrl\":\"u1\",\"viewer\":{\"showPluginsTab\":false}}}}"),
                JSON.readTree("{\"systemDisplayName\":\"B\",\"navigationLabelOverrides\":{\"doc-all\":\"Files\"},\"backupSettings\":{\"onlyOffice\":{\"documentServerUrl\":\"u2\",\"viewer\":{\"showPluginsTab\":true}}}}"));
        SystemConfigurationService.addConfigurationChanges(byPage, "Security", JSON.readTree("{\"passwordMinLength\":8}"), JSON.readTree("{\"passwordMinLength\":12}"));
        SystemConfigurationService.addConfigurationChanges(byPage, "Features", JSON.readTree("[]"), JSON.readTree("[]"));

        assertThat(byPage.keySet()).containsExactly(
                com.eqms.util.ConfigurationAuditPage.GENERAL, com.eqms.util.ConfigurationAuditPage.NAVIGATION_LABELS, com.eqms.util.ConfigurationAuditPage.SECURITY,
                com.eqms.util.ConfigurationAuditPage.INTEGRATIONS, com.eqms.util.ConfigurationAuditPage.PREVIEW_FILE);
        assertThat(byPage.get(com.eqms.util.ConfigurationAuditPage.GENERAL)).extracting("field").containsExactly("General > System Display Name");
        assertThat(byPage.get(com.eqms.util.ConfigurationAuditPage.NAVIGATION_LABELS)).extracting("field").containsExactly("General > Navigation Label Overrides > Doc-all");
        assertThat(byPage.get(com.eqms.util.ConfigurationAuditPage.SECURITY)).extracting("field").containsExactly("Security > Password Min Length");
        assertThat(byPage.get(com.eqms.util.ConfigurationAuditPage.INTEGRATIONS)).extracting("field").containsExactly("General > Backup Settings > Only Office > Document Server Url");
        assertThat(byPage.get(com.eqms.util.ConfigurationAuditPage.PREVIEW_FILE)).extracting("field").containsExactly("General > Backup Settings > Only Office > Viewer > Show Plugins Tab");
        assertThat(byPage).doesNotContainKey(com.eqms.util.ConfigurationAuditPage.FEATURES);
    }

    @Test
    void aSaveThatChangesNothingGivesNoGroup() throws Exception {
        var byPage = new java.util.EnumMap<com.eqms.util.ConfigurationAuditPage, java.util.List<com.eqms.dto.audittrail.AuditTrailChangeResponse>>(com.eqms.util.ConfigurationAuditPage.class);
        SystemConfigurationService.addConfigurationChanges(byPage, "Security", JSON.readTree("{\"passwordMinLength\":8}"), JSON.readTree("{\"passwordMinLength\":8}"));
        assertThat(byPage).isEmpty();
    }
}
