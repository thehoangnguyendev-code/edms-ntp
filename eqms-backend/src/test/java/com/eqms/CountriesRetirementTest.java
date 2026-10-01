package com.eqms;

import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.CapabilityService;
import com.eqms.service.NavigationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CountriesRetirementTest {
    @Test
    void obsoleteCountryGrantsCannotExposeMenuOrSearchResults() {
        var config = mock(SystemConfigurationService.class);
        when(config.isFeatureEnabled(anyString())).thenReturn(true);
        var navigation = new NavigationService(config);
        var grants = Set.of("settings.country.view", "settings.country.manage",
                "settings.education.school.view");
        assertFalse(hasPath(navigation.getNavigation(grants), "/settings/countries"));
        assertTrue(navigation.searchNavigation("Countries", grants).isEmpty());
        assertTrue(hasPath(navigation.getNavigation(grants), "/settings/education/schools"));
    }

    @Test
    void obsoleteCountryManageGrantCannotProvideDictionaryManagementCapability() {
        var permissions = mock(PermissionEvaluationService.class);
        var user = new UserAccount();
        when(permissions.hasAnyPermission(eq(user), any(String[].class))).thenAnswer(call ->
                java.util.Arrays.stream((String[]) call.getRawArguments()[1])
                        .anyMatch("settings.country.manage"::equals));
        assertFalse(new CapabilityService(permissions).getCapabilities(user).canManageDictionaries());
    }

    @Test
    void retiredBackendTypesAreAbsent() {
        for (String type : List.of("com.eqms.controller.SettingsCountriesController",
                "com.eqms.service.CountryManagementService", "com.eqms.service.RestCountriesClient",
                "com.eqms.dto.dictionary.CountryDictionaryResponse")) {
            assertThrows(ClassNotFoundException.class, () -> Class.forName(type));
        }
    }

    private static boolean hasPath(List<NavigationItemResponse> items, String path) {
        return items.stream().anyMatch(item -> path.equals(item.path())
                || (item.children() != null && hasPath(item.children(), path)));
    }
}
