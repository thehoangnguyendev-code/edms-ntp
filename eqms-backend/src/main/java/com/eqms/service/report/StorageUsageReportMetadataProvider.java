package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Storage Usage" (REPORT-SECURITY-SOURCES-2026-11-12): the measurements of the object storage over time: the total size and the number of stored object versions. A person
 * needs settings.storage_location.view and the template is given to the whole system scope only. Never a column: the names of buckets, folders or files.
 */
@Component
public class StorageUsageReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("measuredAt", "Measured At", ReportQueryKit.timestamp("s.measured_at"));
        column("totalGb", "Total Size (GB)", "round(s.total_bytes / 1073741824.0, 2)");
        column("objectVersions", "Stored Object Versions", "s.object_versions");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("measuredFrom", "measuredTo");

    public String code() { return "STORAGE_USAGE"; }
    public String name() { return "Storage Usage"; }
    public String category() { return "Storage"; }
    public String description() { return "Measurements of the object storage over time: total size and number of stored object versions."; }
    public List<String> usePermissions() { return List.of("settings.storage_location.view"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("measuredAt")); }
    public Map<String, String> labels() { return LABELS; }
    /** The key of a measurement is a number; the report keeps a stable identifier of the same form as the others. */
    public String identityColumn() { return "md5('storage-usage:' || s.id::text)::uuid"; }
    public String defaultSort() { return "measuredAt"; }
    public List<String> requiredFields() { return List.of("measuredAt", "totalGb"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "measuredFrom", "name", "Measured from", "type", "DATE"),
                Map.of("code", "measuredTo", "name", "Measured to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of(); }
    public Map<String, String> filterColumns() { return Map.of("measuredFrom", "measuredAt", "measuredTo", "measuredAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from storage_usage_snapshot s where true");
        ReportQueryKit.dates(sql, args, filters, "measured", "s.measured_at::date");
        return new Query(sql.toString(), args);
    }
}
