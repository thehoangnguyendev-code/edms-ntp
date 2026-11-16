package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Backup and Restore Activity" (REPORT-BACKUP-SOURCE-2026-11-12): the Audit Trail records of the Backup and Restore module held in the main database: backups
 * and verifications requested, restore requests, approvals, refusals and finalizations, policy changes, alert acknowledgements and storage checks. The backup sets and the
 * restore requests themselves are kept in the control database of the backup agent and are not read here.
 * Like the Audit Trail type, a report of it is a file of audit records: a person needs audit.view and audit.export besides backup.module.view, the template is given to the
 * whole system scope only, and a run names a date range of at most {@link AuditTrailReportMetadataProvider#MAX_DAYS} days. Never a column: the old and new values, the
 * comment and the reason (free text: they can name a path or a file), the user agent and the device.
 */
@Component
public class BackupActivityReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("timestamp", "Timestamp", ReportQueryKit.timestamp("al.created_at"));
        column("area", "Area", "case when al.entity_type='BACKUP' then 'Backup' else initcap(replace(substr(al.entity_type, 8), '_', ' ')) end");
        column("action", "Action", "initcap(replace(al.action_type, '_', ' '))");
        // A record that is only known by an identifier (an alert) is left empty: an identifier is never shown to a person.
        column("record", "Record", "case when coalesce(nullif(al.entity_name,''), nullif(al.entity_code,'')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then null else coalesce(nullif(al.entity_name,''), nullif(al.entity_code,'')) end");
        column("fromStatus", "From Status", "al.from_status");
        column("toStatus", "To Status", "al.to_status");
        column("user", "User", "coalesce(al.user_full_name, u.full_name)");
        column("employeeCode", "Employee Code", "coalesce(al.employee_code, u.employee_code)");
        column("department", "Department", "al.department_name");
        column("eSignature", "Electronic Signature", "case when al.electronic_signature_applied then 'Yes' else 'No' end");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "area", "action", "createdFrom", "createdTo");
    /** Every Backup and Restore record type of the Audit Trail starts with BACKUP (the underscore is escaped so it is read as itself). */
    private static final String MODULE = "al.entity_type like 'BACKUP\\_%' escape '\\' or al.entity_type='BACKUP'";

    public String code() { return "BACKUP_ACTIVITY"; }
    public String name() { return "Backup and Restore Activity"; }
    public String category() { return "Backup and Restore"; }
    public String description() { return "Audit records of backups, verifications, restore requests and approvals, policy changes and alerts: who did what, when, and whether an electronic signature was applied."; }
    public List<String> requiredPermissions() { return List.of("backup.module.view", "audit.view", "audit.export"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    @Override public boolean runNeedsSignature() { return true; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("timestamp")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "al.id"; }
    public String defaultSort() { return "timestamp"; }
    public List<String> requiredFields() { return List.of("timestamp", "action"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search backup records", "type", "TEXT"),
                Map.of("code", "area", "name", "Area", "type", "LOOKUP"),
                Map.of("code", "action", "name", "Action", "type", "LOOKUP"),
                Map.of("code", "createdFrom", "name", "From Date", "type", "DATE", "required", "true"),
                Map.of("code", "createdTo", "name", "To Date", "type", "DATE", "required", "true"));
    }
    public Map<String, String> lookupColumns() { return Map.of("area", "al.entity_type", "action", "al.action_type"); }
    public Map<String, String> filterColumns() { return Map.of("area", "area", "action", "action", "createdFrom", "timestamp", "createdTo", "timestamp"); }

    @Override
    public void validateRun(Map<String, Object> filters) { validateRun(filters, AuditTrailReportMetadataProvider.MAX_DAYS); }

    @Override
    public void validateRun(Map<String, Object> filters, int maxRangeDays) { ReportQueryKit.requireRange(filters, "created", maxRangeDays); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from audit_logs al left join app_users u on u.id=al.acted_by_user_id where (" + MODULE + ")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (al.entity_type ilike ? escape '\\' or al.action_type ilike ? escape '\\' or coalesce(al.entity_name,'') ilike ? escape '\\'"
                    + " or coalesce(al.entity_code,'') ilike ? escape '\\' or coalesce(al.user_full_name, u.full_name, '') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 5; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("area", "al.entity_type");
        equals.put("action", "al.action_type");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.momentRange(sql, args, filters, "created", "al.created_at");
        return new Query(sql.toString(), args);
    }
}
