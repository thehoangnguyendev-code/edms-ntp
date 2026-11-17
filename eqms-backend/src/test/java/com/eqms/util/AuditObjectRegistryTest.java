package com.eqms.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * AUDIT-OBJECT-REGISTRY-2026-11-17: every kind of object the code writes to the audit log is registered, with the default name of the menu as its Object Type.
 * Writing a new kind without registering it fails here, so the Audit Trail never again shows a technical name as an Object Type.
 */
class AuditObjectRegistryTest {
    /** Object Types that are not the name of a sidebar menu: the kinds of functions that were retired, and the legacy rows written before the screen was recorded. */
    private static final Set<String> NOT_A_MENU = Set.of(
            "Form Settings (retired)", "Offline Media (retired)", "Training Calendar (retired)", "Prompt Specification (retired)", "Prompt Generation (retired)",
            "Table Export (before the screen was recorded)", "Settings (before the split)");

    @Test
    void everyKindTheCodeWritesIsRegistered() throws IOException {
        Set<String> types = AuditedEntityTypesHaveAModuleTest.entityTypesInTheSources();
        assertTrue(types.size() > 50, "the audit calls were not found in the sources: " + types.size());
        Set<String> missing = new TreeSet<>();
        for (String type : types) if (!AuditObjectRegistry.isRegistered(type)) missing.add(type);
        assertEquals(Set.of(), missing, "Kinds written to the audit log but not in AuditObjectRegistry (give each the default menu name of its function): " + missing);
    }

    @Test
    void everyObjectTypeIsTheNameOfAMenuOfTheSidebar() throws IOException {
        Path navigation = Path.of("../eqms/src/app/navigation.ts");
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.exists(navigation), "the front end is not beside the back end here");
        Set<String> labels = new TreeSet<>();
        Matcher m = Pattern.compile("label:\s*\"([^\"]+)\"").matcher(Files.readString(navigation));
        while (m.find()) labels.add(m.group(1));
        Set<String> notMenus = new TreeSet<>();
        for (String name : AuditObjectRegistry.menuNames()) if (!labels.contains(name) && !NOT_A_MENU.contains(name)) notMenus.add(name);
        assertEquals(Set.of(), notMenus, "Object Types that are not the name of a menu in navigation.ts: " + notMenus);
    }

    /** The kinds of file the file-access service names its audit records by (an enum, not a literal the scan above can read). */
    @Test
    void everyKindOfFileIsRegisteredAndPlacedInAModule() {
        for (com.eqms.enums.FileObjectType type : com.eqms.enums.FileObjectType.values()) {
            assertTrue(AuditObjectRegistry.isRegistered(type.name()), type + " is not registered");
            assertFalse(AuditMenuModule.OTHER.equals(AuditMenuModule.forEntityType(type.name())), type + " is not placed in a module");
        }
        assertTrue(AuditObjectRegistry.isRegistered("FILE"));
    }

    /** A report names the Object Type with the same words as the screen: the SQL is made from the same register. */
    @Test
    void theSqlFormComesFromTheSameRegister() {
        String sql = AuditObjectRegistry.sqlCase("al.entity_type", "al.action_type");
        for (String name : AuditObjectRegistry.menuNames()) assertTrue(sql.contains("then '" + name.replace("'", "''") + "'"), name);
        assertTrue(sql.contains("'SETTINGS' and") && sql.contains("like 'POSITION_%' then 'Positions'"), "the records written under the old catch-all type are told apart by their action");
        assertFalse(sql.contains(";"));
    }

    /** An audit record of the old catch-all is read as the kind of dictionary its action names; one that names none stays in the catch-all. */
    @Test
    void anOldCatchAllRecordIsReadByItsAction() {
        assertEquals("Positions", AuditObjectCatalog.typeLabel("SETTINGS", "POSITION_UPDATED"));
        assertEquals("Document Sub-Types", AuditObjectCatalog.typeLabel("SETTINGS", "DOCUMENT_SUB_TYPE_CREATED"));
        assertEquals("Document Types", AuditObjectCatalog.typeLabel("SETTINGS", "DOCUMENT_TYPE_UPDATED"));
        assertEquals("Settings (before the split)", AuditObjectCatalog.typeLabel("SETTINGS", "DELETE"));
        assertEquals("Departments", AuditObjectCatalog.typeLabel("DEPARTMENT", "DEPARTMENT_CREATED"));
    }

    @Test
    void theExceptionsAreStillUsed() {
        for (String name : NOT_A_MENU) assertTrue(AuditObjectRegistry.menuNames().contains(name), name + " is no longer an Object Type: remove it from NOT_A_MENU");
    }

    @Test
    void anObjectTypeNeverLooksLikeATechnicalName() {
        for (String name : AuditObjectRegistry.menuNames()) {
            assertFalse(name.contains("_"), name);
            assertFalse(name.equals(name.toUpperCase()) && name.length() > 4, name);
        }
    }
}
