package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Authentication Events" (REPORT-SECURITY-SOURCES-2026-11-12): sign-ins, failed sign-ins, password and session events of the authentication log. Like the Audit Trail type,
 * a report of it is a file of audit records: a person needs audit.view and audit.export, the template is given to the whole system scope only, and a run names a date range of at
 * most {@link AuditTrailReportMetadataProvider#MAX_DAYS} days. Never a column: the user agent, the device and the details of an event (they can hold a challenge or a reason).
 */
@Component
public class AuthEventReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("timestamp", "Timestamp", ReportQueryKit.timestamp("al.created_at"));
        column("event", "Event", "initcap(replace(al.event_type, '_', ' '))");
        column("user", "User", "au.full_name");
        column("username", "Username", "au.username");
        column("employeeCode", "Employee Code", "au.employee_code");
        column("department", "Department", "au.department");
        column("ipAddress", "IP Address", "al.ip_address");
        // REPORT-FIELD-CATALOG-2026-11-15: more of the metadata the source holds.
        group("Event", "entityType", "Entity Type", ReportQueryKit.words("al.entity_type"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "event", "createdFrom", "createdTo");

    public String code() { return "AUTH_EVENTS"; }
    public String name() { return "Authentication Events"; }
    public String category() { return "Audit"; }
    public String description() { return "Sign-ins, failed sign-ins, password and session events of the authentication log, with the user and the address."; }
    public List<String> requiredPermissions() { return List.of("audit.view", "audit.export"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    @Override public boolean runNeedsSignature() { return true; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("timestamp")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "al.id"; }
    public String defaultSort() { return "timestamp"; }
    public List<String> requiredFields() { return List.of("timestamp", "event"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search authentication events", "type", "TEXT"),
                Map.of("code", "event", "name", "Event", "type", "LOOKUP"),
                Map.of("code", "createdFrom", "name", "From Date", "type", "DATE", "required", "true"),
                Map.of("code", "createdTo", "name", "To Date", "type", "DATE", "required", "true"));
    }
    public Map<String, String> lookupColumns() { return Map.of("event", "al.event_type"); }
    public Map<String, String> filterColumns() { return Map.of("event", "event", "createdFrom", "timestamp", "createdTo", "timestamp"); }

    @Override
    public void validateRun(Map<String, Object> filters) { validateRun(filters, AuditTrailReportMetadataProvider.MAX_DAYS); }

    @Override
    public void validateRun(Map<String, Object> filters, int maxRangeDays) { ReportQueryKit.requireRange(filters, "created", maxRangeDays); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from auth_audit_logs al left join app_users au on au.id=al.user_id where true");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (al.event_type ilike ? escape '\\' or coalesce(au.full_name,'') ilike ? escape '\\' or coalesce(au.username,'') ilike ? escape '\\' or coalesce(al.ip_address,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 4; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("event", "al.event_type");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.momentRange(sql, args, filters, "created", "al.created_at");
        return new Query(sql.toString(), args);
    }
}
