package com.eqms.security;

import com.eqms.controller.SettingsUserController;
import com.eqms.controller.DocumentTypeAdminController;
import com.eqms.controller.ConfigurationController;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;
import java.util.Set;
import java.util.Arrays;

class AdministrativeOperationCatalogTest {
    @Test void sharedLookupOperationsAreNotClassifiedAsAdministrative() {
        assertFalse(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(SettingsUserController.class, "getDepartments"));
        assertFalse(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(SettingsUserController.class, "getDocumentsOperationalConfig"));
        assertFalse(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(DocumentTypeAdminController.class, "listDocumentTypes"));
        assertFalse(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(ConfigurationController.class, "getSecurityConfiguration"));
    }
    @Test void reviewedAdministrativeMutationsAreClassified() {
        assertTrue(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(SettingsUserController.class, "updateSystemConfiguration"));
        assertTrue(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(SettingsUserController.class, "suspendUser"));
        assertTrue(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(DocumentTypeAdminController.class, "createDocumentType"));
    }
    @Test void everyCatalogEntryNamesAnExistingControllerMethod() throws Exception {
        var field = AdministrativeOperationCatalog.class.getDeclaredField("METHODS");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        var entries = (Map<String, Set<String>>) field.get(null);
        for (var entry : entries.entrySet()) {
            var controller = Class.forName(entry.getKey());
            var methods = Arrays.stream(controller.getDeclaredMethods()).map(java.lang.reflect.Method::getName).collect(java.util.stream.Collectors.toSet());
            for (String name : entry.getValue()) assertTrue(methods.contains(name), entry.getKey() + "." + name);
        }
    }
    @Test void everyProtectedControllerExists() throws Exception {
        // a misspelt name would leave a whole administration controller unprotected without any failure
        var field = AdministrativeOperationCatalog.class.getDeclaredField("ADMIN_CONTROLLERS");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        var names = (Set<String>) field.get(null);
        for (String name : names) assertDoesNotThrow(() -> Class.forName("com.eqms.controller." + name), name);
    }
}
