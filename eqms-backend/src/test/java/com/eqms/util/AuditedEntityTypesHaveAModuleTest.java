package com.eqms.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * REPORT-MODULE-FIXED-2026-11-17: an entity type that the code writes to the audit log must be placed in a module of the sidebar ({@link AuditMenuModule}).
 * Adding a feature that writes a new entity type without placing it fails here, instead of showing "Other" in the Audit Trail and in its reports.
 * The audit calls are read from the sources (a literal as the entity type of a log call, or as an ENTITY_TYPE constant).
 */
class AuditedEntityTypesHaveAModuleTest {
    /** Written by the code, but whose screen nobody could name yet: they show as "Other" until the owner says (each is checked to still be unplaced, so the list can only shrink). */
    private static final Set<String> NOT_PLACED_YET = Set.of("PROMPT_SPECIFICATION", "PROMPT_GENERATION_RUN");

    private static final Pattern CALL = Pattern.compile(
            "(?:logAs|logAsWithUserReason|logSafely|logSystem|logExternal|auditTrail\\.log|auditTrailService\\.log|audit\\.log)\\(\\s*(?:[A-Za-z_.()]+,\\s*)?\"([A-Za-z_ ]+)\"");
    private static final Pattern CONSTANT = Pattern.compile("(?:ENTITY_TYPE|AUDIT_ENTITY)[A-Z_]*\\s*=\\s*\"([A-Za-z_ ]+)\"");

    static Set<String> entityTypesInTheSources() throws IOException {
        Set<String> found = new TreeSet<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
            for (Path file : (Iterable<Path>) files.filter(path -> path.toString().endsWith(".java"))::iterator) {
                String text = Files.readString(file);
                for (Pattern pattern : new Pattern[] {CALL, CONSTANT}) {
                    Matcher matcher = pattern.matcher(text);
                    while (matcher.find()) found.add(matcher.group(1));
                }
            }
        }
        return found;
    }

    @Test
    void everyEntityTypeTheCodeWritesIsPlacedInAModule() throws IOException {
        Set<String> types = entityTypesInTheSources();
        // a broken pattern must not make this test pass for nothing
        assertTrue(types.size() > 50, "the audit calls were not found in the sources: " + types.size());
        Set<String> unplaced = new TreeSet<>();
        for (String type : types) if (AuditMenuModule.OTHER.equals(AuditMenuModule.forEntityType(type)) && !NOT_PLACED_YET.contains(type)) unplaced.add(type);
        assertEquals(Set.of(), unplaced, "Entity types written by the code that are not placed in AuditMenuModule (name the level-1 menu of their screen): " + unplaced);
    }

    @Test
    void theListOfUnplacedTypesCanOnlyShrink() throws IOException {
        Set<String> types = entityTypesInTheSources();
        for (String type : NOT_PLACED_YET) {
            assertEquals(AuditMenuModule.OTHER, AuditMenuModule.forEntityType(type), type + " is placed now: remove it from NOT_PLACED_YET");
            assertTrue(types.contains(type), type + " is no longer written by the code: remove it from NOT_PLACED_YET");
        }
    }
}
