package com.eqms.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.eqms.service.AuditNotificationEvents;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * CONFIGURATION-PAGES-SPLIT-2026-11-17: each page of Configuration is its own menu, so the Audit Trail names a configuration change by the page that shows it (the Object Type is
 * the menu name) and the records written before the split keep the name of the group. The names are those of navigation.ts, and the pages the front end lists in configurationPages.ts.
 */
class ConfigurationAuditPageTest {
    private static final Map<ConfigurationAuditPage, String> MENU = Map.of(
            ConfigurationAuditPage.GENERAL, "General",
            ConfigurationAuditPage.NAVIGATION_LABELS, "Navigation Labels",
            ConfigurationAuditPage.SECURITY, "Security",
            ConfigurationAuditPage.NOTIFICATIONS, "Notifications",
            ConfigurationAuditPage.INTEGRATIONS, "Integrations",
            ConfigurationAuditPage.PREVIEW_FILE, "Preview File",
            ConfigurationAuditPage.IMAGE_WATERMARK, "Image Watermark",
            ConfigurationAuditPage.FEATURES, "Features");

    @Test
    void aSettingBelongsToThePageThatShowsIt() {
        assertEquals(ConfigurationAuditPage.SECURITY, ConfigurationAuditPage.of("Security", "passwordMinLength"));
        assertEquals(ConfigurationAuditPage.NOTIFICATIONS, ConfigurationAuditPage.of("Notifications", "emailConfig.senderEmail"));
        assertEquals(ConfigurationAuditPage.INTEGRATIONS, ConfigurationAuditPage.of("Integrations", "storage.provider"));
        assertEquals(ConfigurationAuditPage.FEATURES, ConfigurationAuditPage.of("Features", "[feat-a].enabled"));
        assertEquals(ConfigurationAuditPage.PREVIEW_FILE, ConfigurationAuditPage.of("Documents", "allowDownload"));
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of("General", "systemDisplayName"));
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of("General", "appearance.primaryColor"));
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of("General", "backupSettings.somethingElse"));
    }

    @Test
    void theGeneralSectionIsSharedByFourPagesAndTellsThemApartByThePathOfTheSetting() {
        assertEquals(ConfigurationAuditPage.NAVIGATION_LABELS, ConfigurationAuditPage.of("General", "navigationLabelOverrides"));
        assertEquals(ConfigurationAuditPage.NAVIGATION_LABELS, ConfigurationAuditPage.of("General", "navigationLabelOverrides.doc-all"));
        assertEquals(ConfigurationAuditPage.NAVIGATION_LABELS, ConfigurationAuditPage.of("General", "navigationLabelOverrides[doc-all]"));
        assertEquals(ConfigurationAuditPage.IMAGE_WATERMARK, ConfigurationAuditPage.of("General", "imageWatermark.evidence.text"));
        assertEquals(ConfigurationAuditPage.INTEGRATIONS, ConfigurationAuditPage.of("General", "backupSettings.onlyOffice.documentServerUrl"));
        assertEquals(ConfigurationAuditPage.PREVIEW_FILE, ConfigurationAuditPage.of("General", "backupSettings.onlyOffice.viewer.showPluginsTab"));
        // a name that only starts like another does not belong to it
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of("General", "navigationLabelOverridesNote"));
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of("General", "imageWatermarkNote"));
    }

    @Test
    void aMissingSectionOrPathIsTheGeneralPage() {
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of(null, null));
        assertEquals(ConfigurationAuditPage.GENERAL, ConfigurationAuditPage.of("", ""));
    }

    @Test
    void everyPageIsRegisteredUnderItsMenuNameAndPlacedInSystemAdministration() {
        assertEquals(MENU.keySet(), new HashSet<>(List.of(ConfigurationAuditPage.values())), "every page is named in this test");
        for (ConfigurationAuditPage page : ConfigurationAuditPage.values()) {
            assertTrue(AuditObjectRegistry.isRegistered(page.entityType()), page + " is not in the register");
            assertEquals(MENU.get(page), AuditObjectRegistry.menuName(page.entityType()), page.name());
            assertEquals(MENU.get(page), AuditObjectCatalog.typeLabel(page.entityType()), page.name());
            assertEquals(AuditMenuModule.SYSTEM_ADMINISTRATION, AuditMenuModule.forEntityType(page.entityType()), page.name());
        }
        assertEquals(ConfigurationAuditPage.values().length, new HashSet<>(java.util.Arrays.stream(ConfigurationAuditPage.values()).map(ConfigurationAuditPage::entityType).toList()).size(), "one entity type for each page");
    }

    @Test
    void theRecordsWrittenBeforeTheSplitKeepTheNameOfTheGroup() {
        assertEquals("Configuration", AuditObjectRegistry.menuName("SYSTEM_CONFIGURATION"));
        assertEquals("Configuration", AuditObjectRegistry.menuName("System Configuration"));
        assertEquals(AuditMenuModule.SYSTEM_ADMINISTRATION, AuditMenuModule.forEntityType("SYSTEM_CONFIGURATION"));
        assertFalse(MENU.containsValue(AuditObjectRegistry.menuName("SYSTEM_CONFIGURATION")), "the old kind is not one of the pages");
    }

    @Test
    void theObjectsThatAreAdministeredOnAPageAreNamedByThatPage() {
        assertEquals("Security", AuditObjectRegistry.menuName("ADMINISTRATIVE_NETWORK_POLICY"));
        assertEquals("General", AuditObjectRegistry.menuName("DASHBOARD_ROLE_LAYOUT"));
        assertEquals("Integrations", AuditObjectRegistry.menuName("STORAGE_USAGE_POLICY"));
    }

    @Test
    void theNotificationOfAConfigurationChangeFollowsEveryPage() {
        var event = AuditNotificationEvents.all().stream().filter(e -> "system.configuration_changed".equals(e.code())).findFirst().orElseThrow();
        List<String> listed = new ArrayList<>(event.entityTypes());
        for (ConfigurationAuditPage page : ConfigurationAuditPage.values()) assertTrue(listed.contains(page.entityType()), page.entityType() + " would not raise the notification");
        assertTrue(listed.contains("SYSTEM_CONFIGURATION"));
        for (ConfigurationAuditPage page : ConfigurationAuditPage.values()) {
            assertFalse(AuditNotificationEvents.forAction(page.entityType(), "SYSTEM_CONFIGURATION_UPDATED").isEmpty(), page.entityType());
        }
    }

    /** V806: each page has its own View and Manage permission, named after the page, and the migration creates exactly those. */
    @Test
    void eachPageHasItsOwnViewAndManagePermissionAndTheMigrationCreatesThem() throws Exception {
        assertEquals("settings.config_security.view", ConfigurationAuditPage.SECURITY.viewPermission());
        assertEquals("settings.config_navigation_labels.manage", ConfigurationAuditPage.NAVIGATION_LABELS.managePermission());
        assertEquals(ConfigurationAuditPage.values().length, ConfigurationAuditPage.allViewPermissions().length);
        assertEquals(ConfigurationAuditPage.values().length, new HashSet<>(List.of(ConfigurationAuditPage.allManagePermissions())).size());
        String migration = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/migration/V806__split_configuration_permission_per_page.sql"));
        for (ConfigurationAuditPage page : ConfigurationAuditPage.values()) {
            assertTrue(migration.contains("'" + page.viewPermission() + "'"), page.viewPermission() + " is not created by V806");
            assertTrue(migration.contains("'" + page.managePermission() + "'"), page.managePermission() + " is not created by V806");
        }
    }

    /** The old pair no longer exists in the database; a check of it in the code would deny everybody without a sound. */
    @Test
    void nothingInTheSourcesStillChecksTheRetiredPermission() throws Exception {
        try (var files = java.nio.file.Files.walk(java.nio.file.Path.of("src/main/java"))) {
            var offenders = files.filter(f -> f.toString().endsWith(".java")).filter(f -> {
                try {
                    String text = java.nio.file.Files.readString(f);
                    return text.contains("\"settings.configuration.view\"") || text.contains("\"settings.configuration.manage\"");
                } catch (java.io.IOException e) {
                    throw new java.io.UncheckedIOException(e);
                }
            }).toList();
            assertTrue(offenders.isEmpty(), "retired permission still checked in " + offenders);
        }
    }

    @Test
    void theNotificationOfAConfigurationChangeGoesToWhoeverManagesAnyPage() {
        var event = AuditNotificationEvents.all().stream().filter(e -> "system.configuration_changed".equals(e.code())).findFirst().orElseThrow();
        var recipients = event.rules().stream().map(AuditNotificationEvents.Rule::value).toList();
        for (String manage : ConfigurationAuditPage.allManagePermissions()) assertTrue(recipients.contains(manage), manage);
    }
}
