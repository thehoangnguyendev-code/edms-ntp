package com.eqms.service;

import com.eqms.dto.navigation.NavigationItemResponse;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Configuration is a menu group: each tab of the old screen (?tab=...) is its own page and menu entry, in the order the tabs had. Each page is shown by the View permission of that
 * page (settings.config_<page>.view, V806). The frontend lists the same pages in configurationPages.ts and navigation.ts.
 */
class NavigationConfigurationGroupTest {
    private static final List<String[]> PAGES = List.of(
            new String[]{"config-general", "General", "/settings/configuration/general"},
            new String[]{"config-navigation-labels", "Navigation Labels", "/settings/configuration/navigation-labels"},
            new String[]{"config-security", "Security", "/settings/configuration/security"},
            new String[]{"config-notifications", "Notifications", "/settings/configuration/notifications"},
            new String[]{"config-integrations", "Integrations", "/settings/configuration/integrations"},
            new String[]{"config-preview-file", "Preview File", "/settings/configuration/preview-file"},
            new String[]{"config-image-watermark", "Image Watermark", "/settings/configuration/image-watermark"},
            new String[]{"config-features", "Features", "/settings/configuration/features"});

    private static final String[] ALL_VIEWS = {"settings.config_general.view", "settings.config_navigation_labels.view", "settings.config_security.view", "settings.config_notifications.view",
            "settings.config_integrations.view", "settings.config_preview_file.view", "settings.config_image_watermark.view", "settings.config_features.view"};

    private static String[] with(String[] base, String... more) {
        var all = new java.util.ArrayList<>(List.of(base));
        all.addAll(List.of(more));
        return all.toArray(String[]::new);
    }

    private List<NavigationItemResponse> menuFor(boolean systemAdminEnabled, String... permissions) {
        var configuration = mock(SystemConfigurationService.class);
        when(configuration.isFeatureEnabled(anyString())).thenReturn(true);
        when(configuration.isFeatureEnabled("feat-system-admin")).thenReturn(systemAdminEnabled);
        return new NavigationService(configuration).getNavigation(new HashSet<>(Set.of(permissions)));
    }

    private static NavigationItemResponse find(List<NavigationItemResponse> items, String id) {
        for (var item : items) {
            if (id.equals(item.id())) return item;
            if (item.children() != null) {
                var found = find(item.children(), id);
                if (found != null) return found;
            }
        }
        return null;
    }

    @Test
    void theHolderOfAllTheViewPermissionsSeesTheGroupWithTheEightPagesInTheOrderOfTheOldTabs() {
        var group = find(menuFor(true, ALL_VIEWS), "config");
        assertNotNull(group);
        assertEquals("Configuration", group.label());
        assertNull(group.path(), "the group is not a page");
        assertEquals(PAGES.size(), group.children().size());
        for (int i = 0; i < PAGES.size(); i++) {
            var child = group.children().get(i);
            assertEquals(PAGES.get(i)[0], child.id());
            assertEquals(PAGES.get(i)[1], child.label());
            assertEquals(PAGES.get(i)[2], child.path());
            assertNull(child.children());
        }
    }

    @Test
    void theGroupSitsInSystemAdministrationBeforeTheESignConfigAndNoPageIsAMenuEntryOfItsOwnElsewhere() {
        var menu = menuFor(true, with(ALL_VIEWS, "settings.electronic_signature.view"));
        var systemAdministration = menu.stream().filter(item -> item.children() != null && item.children().stream().anyMatch(child -> "config".equals(child.id()))).findFirst().orElseThrow();
        var ids = systemAdministration.children().stream().map(NavigationItemResponse::id).toList();
        assertTrue(ids.indexOf("config") >= 0 && ids.indexOf("config") < ids.indexOf("electronic-signature-policies"));
        assertTrue(menu.stream().noneMatch(item -> "config".equals(item.id())), "it is not a top-level entry");
    }

    @Test
    void everyMenuIdOfTheGroupIsUniqueAcrossTheWholeMenu() {
        var menu = menuFor(true, with(ALL_VIEWS, "settings.notification_policy.view", "documents.admin.properties.view"));
        var all = new java.util.ArrayList<String>();
        collect(menu, all);
        assertEquals(all.size(), new HashSet<>(all).size(), "a repeated id lights up two entries at once");
    }

    private static void collect(List<NavigationItemResponse> items, List<String> out) {
        for (var item : items) {
            out.add(item.id());
            if (item.children() != null) collect(item.children(), out);
        }
    }

    @Test
    void eachPageIsShownOnlyToTheHolderOfItsOwnViewPermission() {
        var menu = menuFor(true, "settings.config_security.view", "settings.config_features.view");
        var group = find(menu, "config");
        assertNotNull(group);
        assertEquals(List.of("config-security", "config-features"), group.children().stream().map(NavigationItemResponse::id).toList());
        assertNull(find(menu, "config-general"));
        assertNull(find(menu, "config-integrations"));
    }

    @Test
    void theManagePermissionAloneDoesNotShowAPage_andTheOldPermissionIsGone() {
        var menu = menuFor(true, "settings.config_security.manage", "settings.configuration.view");
        assertNull(find(menu, "config"));
    }

    @Test
    void theESignConfigAndSystemInformationHaveTheirOwnPermissions() {
        var menu = menuFor(true, "settings.electronic_signature.view", "settings.system_info.view");
        assertNotNull(find(menu, "electronic-signature-policies"));
        assertNotNull(find(menu, "system-information"));
        assertNull(find(menu, "config"));
    }

    @Test
    void someoneWithoutTheViewPermissionSeesNeitherTheGroupNorAnyPage() {
        var menu = menuFor(true, "settings.notification_policy.view");
        assertNull(find(menu, "config"));
        PAGES.forEach(page -> assertNull(find(menu, page[0]), page[0]));
    }

    @Test
    void whenSystemAdministrationIsSwitchedOffNoPageIsShown() {
        var menu = menuFor(false, ALL_VIEWS);
        assertNull(find(menu, "config"));
        PAGES.forEach(page -> assertNull(find(menu, page[0]), page[0]));
    }
}
