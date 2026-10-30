package com.eqms.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Accumulates actual object-version measurements; callers must not publish partial scans. */
public final class StorageUsageAccumulator {
    public record Usage(long bytes, long objects, Map<String, Long> byModule, Map<String, Long> byFileType) {}
    private final Map<String, String> prefixes;
    private final Map<String, Long> modules = new LinkedHashMap<>();
    private final Map<String, Long> types = new LinkedHashMap<>();
    private long bytes;
    private long objects;

    public StorageUsageAccumulator(Map<String, String> prefixToModule) {
        prefixes = Map.copyOf(prefixToModule);
    }

    public void add(String objectKey, long size, boolean deleteMarker) {
        if (deleteMarker) return;
        if (objectKey == null || objectKey.isBlank() || size < 0) throw new IllegalArgumentException("Invalid measured object");
        String module = prefixes.entrySet().stream()
                .filter(entry -> objectKey.equals(entry.getKey()) || objectKey.startsWith(entry.getKey() + "/"))
                .max(java.util.Comparator.comparingInt(entry -> entry.getKey().length()))
                .map(Map.Entry::getValue).orElse("other");
        String filename = objectKey.substring(objectKey.lastIndexOf('/') + 1);
        int dot = filename.lastIndexOf('.');
        String type = dot > 0 && dot < filename.length() - 1 ? filename.substring(dot + 1).toLowerCase(Locale.ROOT) : "unknown";
        if (!type.matches("[a-z0-9]{1,16}")) type = "other";
        bytes = Math.addExact(bytes, size);
        objects = Math.addExact(objects, 1);
        modules.merge(module, size, Math::addExact);
        types.merge(type, size, Math::addExact);
    }
    public Usage snapshot() { return new Usage(bytes, objects, Map.copyOf(modules), Map.copyOf(types)); }
}
