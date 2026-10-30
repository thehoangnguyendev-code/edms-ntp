package com.eqms.service;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class StorageUsageAccumulatorTest {
    @Test void countsVersionsAndUsesLongestPrefixWithoutCountingDeleteMarkers() {
        var usage = new StorageUsageAccumulator(Map.of("documents", "documents", "documents/templates", "templates"));
        usage.add("documents/a.PDF", 10, false);
        usage.add("documents/a.PDF", 5, false);
        usage.add("documents/templates/b.docx", 20, false);
        usage.add("documents/delete.pdf", 0, true);
        var result = usage.snapshot();
        assertEquals(35, result.bytes());
        assertEquals(3, result.objects());
        assertEquals(15, result.byModule().get("documents"));
        assertEquals(20, result.byModule().get("templates"));
        assertEquals(15, result.byFileType().get("pdf"));
    }
    @Test void rejectsInvalidDataAndOverflow() {
        var usage = new StorageUsageAccumulator(Map.of());
        assertThrows(IllegalArgumentException.class, () -> usage.add("invalid", -1, false));
        usage.add("one", Long.MAX_VALUE, false);
        assertThrows(ArithmeticException.class, () -> usage.add("two", 1, false));
    }
    @Test void classifiesEveryRegisteredStorageDomainAndUnknownKeys() {
        var prefixes = new java.util.LinkedHashMap<String, String>();
        for (StorageDomain domain : StorageDomain.values()) prefixes.put(domain.prefix(), domain.prefix());
        var usage = new StorageUsageAccumulator(prefixes);
        for (StorageDomain domain : StorageDomain.values()) usage.add(domain.prefix() + "/file.pdf", 1, false);
        usage.add("documents-old/file.pdf", 2, false);
        var result = usage.snapshot();
        for (StorageDomain domain : StorageDomain.values()) assertEquals(1L, result.byModule().get(domain.prefix()));
        assertEquals(2L, result.byModule().get("other"));
    }
}
