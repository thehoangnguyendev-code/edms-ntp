package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Report Type "Audit Trail" (REPORT-PLATFORM-2026-10-15, phase 2): the records of the Audit Trail with the columns the Audit Trail screen shows. A report of it is a
 * file of audit records, so a person needs both audit.view and audit.export, and a template is given to the whole system scope only (the screen is not scoped by
 * department). A run must name a date range of at most {@link #MAX_DAYS} days; the old and new values, the user agent and the device are not columns.
 */
@Component
public class AuditTrailReportMetadataProvider implements ReportMetadataProvider {
    /** The widest range one report may cover. */
    public static final int MAX_DAYS = 92;

    /** The module as the sidebar names it ("Training Management", "Document Control"), the same as the Audit Trail screen; the stored entity type is a machine value (REPORT-MODULE-NAMES-2026-11-16). */
    static final String MODULE = com.eqms.util.AuditMenuModule.sqlCase("al.entity_type");
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("timestamp", "Timestamp", "al.created_at");
        column("module", "Module", MODULE);
        // The action is the one verb of the Audit Trail screen; the filter and the picker still compare the stored code (REPORT-ACTION-LABEL-2026-11-16, REPORT-AUDIT-DISPLAY-2026-11-17).
        column("action", "Action", com.eqms.util.AuditActionVerb.sqlCase("al.action_type"));
        // An identifier is never shown to a person: a record known only by its identifier is left empty (REPORT-NO-IDENTIFIER, the rule of every screen).
        column("record", "Record", "case when coalesce(nullif(al.entity_name,''), nullif(al.entity_code,''), nullif(al.document_number,'')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then null else coalesce(nullif(al.entity_name,''), nullif(al.entity_code,''), nullif(al.document_number,'')) end");
        column("fromStatus", "From Status", "al.from_status");
        column("toStatus", "To Status", "al.to_status");
        column("description", "Description", "al.comment");
        column("reason", "Reason", "al.reason");
        column("user", "User", "coalesce(al.user_full_name, u.full_name)");
        column("employeeCode", "Employee Code", "coalesce(al.employee_code, u.employee_code)");
        column("department", "Department", "al.department_name");
        column("ipAddress", "IP Address", "al.ip_address");
        column("eSignature", "Electronic Signature", "case when al.electronic_signature_applied then 'Yes' else 'No' end");
        // REPORT-FIELD-CATALOG-2026-11-15: more of the metadata the source holds.
        group("Record", "recordCode", "Record Code", "al.entity_code");
        group("Record", "documentNumber", "Document Number", "al.document_number");
        group("Record", "revisionNumber", "Revision", "al.revision_number");
        group("Record", "entityStatus", "Record Status", "al.entity_status");
        group("User", "username", "Username", "coalesce(al.username, u.username)");
        group("User", "roleName", "Role", "al.role_name");
        group("User", "positionName", "Position", "al.position_name");
        group("User", "accessProfiles", "Access Profiles", "array_to_string(al.access_profile_names, '; ')");
        group("Device", "deviceName", "Device", "al.device_name");
        group("Device", "deviceBrowser", "Browser", "al.device_browser");
        group("Device", "devicePlatform", "Platform", "al.device_platform");
        group("Action", "processingSeconds", "Processing Time (s)", "al.processing_duration_seconds");
        // what was done in the words of the code, as the detail screen of a record writes it (the Action column is the one verb)
        group("Action", "actionDetail", "Action Detail", ReportQueryKit.auditAction("al.action_type"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }
    @Override public Set<String> sensitiveFields() { return Set.of("deviceName"); }

    public String code() { return "AUDIT_TRAIL"; }
    public String name() { return "Audit Trail"; }
    public String category() { return "Audit"; }
    public String description() { return "Records of the Audit Trail: who did what to which record, when, from where, and whether an electronic signature was applied."; }
    public List<String> requiredPermissions() { return List.of("audit.view", "audit.export"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    @Override public boolean runNeedsSignature() { return true; }
    public Map<String, String> columns() { return COLUMNS; }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "al.id"; }
    public String defaultSort() { return "timestamp"; }
    public List<String> requiredFields() { return List.of("timestamp", "module", "action"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search audit records", "type", "TEXT"),
                Map.of("code", "module", "name", "Module", "type", "LOOKUP"),
                Map.of("code", "action", "name", "Action", "type", "LOOKUP"),
                Map.of("code", "createdFrom", "name", "From Date", "type", "DATE", "required", "true"),
                Map.of("code", "createdTo", "name", "To Date", "type", "DATE", "required", "true"));
    }
    public Map<String, String> lookupColumns() { return Map.of("module", MODULE, "action", "al.action_type"); }
    public Map<String, String> filterColumns() { return Map.of("module", "module", "action", "action", "createdFrom", "timestamp", "createdTo", "timestamp"); }

    /** A run names its range: both dates, in order, and no wider than {@link #MAX_DAYS} days. */
    @Override
    public void validateRun(Map<String, Object> filters) { validateRun(filters, MAX_DAYS); }

    @Override
    public void validateRun(Map<String, Object> filters, int maxRangeDays) {
        LocalDate from = date(filters.get("createdFrom"));
        LocalDate to = date(filters.get("createdTo"));
        if (from == null || to == null) throw new IllegalArgumentException("REPORT_AUDIT_RANGE_REQUIRED");
        if (to.isBefore(from)) throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID");
        if (ChronoUnit.DAYS.between(from, to) + 1 > maxRangeDays) throw new IllegalArgumentException("REPORT_AUDIT_RANGE_TOO_WIDE");
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        Set<String> permitted = Set.of("search", "module", "action", "createdFrom", "createdTo");
        if (!permitted.containsAll(filters.keySet())) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        if (filters.values().stream().anyMatch(value -> value != null && !(value instanceof String))) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        // The Audit Trail is not divided by department or business unit: only the whole-system scope shows it.
        if (!scopes.contains("SYSTEM")) throw new SecurityException("REPORT_SCOPE_DENIED");
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from audit_logs al left join app_users u on u.id=al.acted_by_user_id where true");
        String search = text(filters.get("search"));
        if (search.length() > 200) throw new IllegalArgumentException("REPORT_SEARCH_TOO_LONG");
        if (!search.isBlank()) {
            String term = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            sql.append(" and (al.entity_type ilike ? escape '\\' or al.action_type ilike ? escape '\\' or al.comment ilike ? escape '\\'"
                    + " or al.entity_name ilike ? escape '\\' or al.entity_code ilike ? escape '\\' or al.document_number ilike ? escape '\\'"
                    + " or coalesce(al.user_full_name, u.full_name) ilike ? escape '\\')");
            for (int i = 0; i < 7; i++) args.add(term);
        }
        for (String field : List.of("module", "action")) {
            String value = text(filters.get(field));
            if (value.length() > 100) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
            if (!value.isBlank()) {
                if ("module".equals(field)) {
                    // The module is picked by its name; a template or a schedule saved before that holds the stored entity type, which still selects the same records.
                    sql.append(" and (").append(MODULE).append("=? or al.entity_type=?)");
                    args.add(value);
                    args.add(value);
                } else {
                    sql.append(" and al.action_type=?");
                    args.add(value);
                }
            }
        }
        LocalDate from = date(filters.get("createdFrom"));
        LocalDate to = date(filters.get("createdTo"));
        if (from != null && to != null && to.isBefore(from)) throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID");
        // The whole of the last day is included: a record at 23:59 on the "to" date is in the range.
        if (from != null) { sql.append(" and al.created_at>=?"); args.add(java.sql.Timestamp.valueOf(from.atStartOfDay())); }
        if (to != null) { sql.append(" and al.created_at<?"); args.add(java.sql.Timestamp.valueOf(to.plusDays(1).atStartOfDay())); }
        return new Query(sql.toString(), args);
    }

    private static LocalDate date(Object value) {
        String text = value == null ? "" : String.valueOf(value).trim();
        try { return text.isBlank() ? null : LocalDate.parse(text); }
        catch (RuntimeException invalid) { throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID"); }
    }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
}
