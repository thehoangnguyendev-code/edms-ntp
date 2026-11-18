package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Permission Holders" (SECURITY-AUTHORIZATION-REVIEW D6, owner 2026-11-18: the export of Access Explorer goes through Reports, so the run is audited, authorized and kept
 * like every other report): one row for each permission a person holds, with the access profile and the permission set that give it. It is built from the chain the system itself uses
 * to decide (person, ACTIVE access profile, ACTIVE permission set, permission), so it says what is enforced. A person needs settings.user.view or security.access_profiles.view, as
 * for Access Explorer, and the template is given to the whole system scope only. Never a column: anything of a person beyond their name, department, status and sign-in.
 */
@Component
public class PermissionHolderReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("permissionCode", "Permission Code", "p.code");
        column("permission", "Permission", "p.name");
        column("module", "Module", "coalesce(p.module_key, '')");
        column("category", "Category", "coalesce(p.category, '')");
        column("employeeCode", "Employee Code", "u.employee_code");
        column("fullName", "Person", "u.full_name");
        column("username", "Username", "u.username");
        column("department", "Department", "u.department");
        column("status", "Account Status", "u.status");
        column("accessProfile", "Through Access Profile", "rl.name");
        column("permissionSet", "Through Permission Set", "ps.name");
        column("lastLoginAt", "Last Sign-in", ReportQueryKit.timestamp("u.last_login_at"));
        group("Person", "businessUnit", "Business Unit", "u.business_unit");
        group("Person", "position", "Position", "u.position");
        group("Access", "timeLimitedUntil", "Time-limited Until", ReportQueryKit.timestamp("(select max(g.end_at) from time_limited_user_grants g where g.user_id=u.id and g.status='ACTIVE')"));
        group("Access", "mfa", "Second Factor", "case when u.mfa_enabled then 'On' else 'Off' end");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "permission", "module", "status", "department", "lastLoginFrom", "lastLoginTo");

    public String code() { return "PERMISSION_HOLDERS"; }
    public String name() { return "Permission Holders"; }
    public String category() { return "Security"; }
    public String description() { return "Who holds each permission, and through which access profile and permission set."; }
    public List<String> usePermissions() { return List.of("settings.user.view", "security.access_profiles.view"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("lastLoginAt", "timeLimitedUntil")); }
    public Map<String, String> labels() { return LABELS; }
    /** One row for each permission set item, access profile and person, so the same person with the same permission through two profiles is two rows. */
    public String identityColumn() { return "md5(concat(psi.id::text, rl.id::text, u.id::text))::uuid"; }
    public String defaultSort() { return "permissionCode"; }
    public List<String> requiredFields() { return List.of("permissionCode", "fullName"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search permissions and people", "type", "TEXT"),
                Map.of("code", "permission", "name", "Permission", "type", "LOOKUP"),
                Map.of("code", "module", "name", "Module", "type", "LOOKUP"),
                Map.of("code", "status", "name", "Account Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "lastLoginFrom", "name", "Last sign-in from", "type", "DATE"),
                Map.of("code", "lastLoginTo", "name", "Last sign-in to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("permission", "p.code", "module", "coalesce(p.module_key, '')", "status", "u.status", "department", "u.department"); }
    public Map<String, String> filterColumns() { return Map.of("permission", "permissionCode", "module", "module", "status", "status", "department", "department", "lastLoginFrom", "lastLoginAt", "lastLoginTo", "lastLoginAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from permission_set_items psi "
                + "join permissions p on p.id=psi.permission_id "
                + "join permission_sets ps on ps.id=psi.permission_set_id and ps.active "
                + "join access_profile_permission_sets aps on aps.permission_set_id=ps.id "
                + "join roles rl on rl.id=aps.access_profile_id and rl.is_active "
                + "join user_access_profiles uap on uap.access_profile_id=rl.id "
                + "join app_users u on u.id=uap.user_id where true");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (p.code ilike ? escape '\\' or p.name ilike ? escape '\\' or u.full_name ilike ? escape '\\' or u.username ilike ? escape '\\' or coalesce(u.employee_code,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 5; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("permission", "p.code"); equals.put("module", "coalesce(p.module_key, '')"); equals.put("status", "u.status"); equals.put("department", "u.department");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "lastLogin", "u.last_login_at::date");
        return new Query(sql.toString(), args);
    }
}
