package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Users and Access Profiles" (REPORT-SECURITY-SOURCES-2026-11-12): the user accounts with their status, department, position, access profiles and last sign-in. It answers
 * "who has no access profile", "who has not signed in" and "who is suspended". A person needs settings.user.view, as for the user list. Never a column: the email, phone, date of birth,
 * address, identity number, password data, and anything of the security settings of an account beyond whether a second factor is on.
 */
@Component
public class UserAccessReportMetadataProvider implements ReportMetadataProvider {
    private static final String PROFILES = "(select string_agg(rl.name, '; ' order by rl.name) from user_access_profiles uap join roles rl on rl.id=uap.access_profile_id where uap.user_id=u.id)";
    private static final String HAS_PROFILE = "case when exists(select 1 from user_access_profiles x where x.user_id=u.id) then 'ASSIGNED' else 'NONE' end";
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("employeeCode", "Employee Code", "u.employee_code");
        column("fullName", "Name", "u.full_name");
        column("username", "Username", "u.username");
        column("department", "Department", "u.department");
        column("businessUnit", "Business Unit", "u.business_unit");
        column("position", "Position", "u.position");
        column("status", "Status", "u.status");
        column("accessProfiles", "Access Profiles", "coalesce(" + PROFILES + ", '')");
        column("profileCount", "Number of Access Profiles", "(select count(*) from user_access_profiles x where x.user_id=u.id)");
        column("profileState", "Access Profile", "case when exists(select 1 from user_access_profiles x where x.user_id=u.id) then 'Assigned' else 'None' end");
        column("mfa", "Second Factor", "case when u.mfa_enabled then 'On' else 'Off' end");
        column("lastLoginAt", "Last Sign-in", ReportQueryKit.timestamp("u.last_login_at"));
        column("failedLogins", "Failed Sign-ins", "u.failed_login_count");
        column("passwordChangedAt", "Password Changed", ReportQueryKit.timestamp("u.password_changed_at"));
        column("startDate", "Start Date", "u.start_date");
        column("createdAt", "Created", ReportQueryKit.timestamp("u.created_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "status", "department", "businessUnit", "profileState", "lastLoginFrom", "lastLoginTo", "createdFrom", "createdTo");

    public String code() { return "USER_ACCESS"; }
    public String name() { return "Users and Access Profiles"; }
    public String category() { return "Security"; }
    public String description() { return "User accounts with their status, department, position, access profiles, second factor and last sign-in."; }
    public List<String> usePermissions() { return List.of("settings.user.view"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("lastLoginAt", "passwordChangedAt", "startDate", "createdAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "u.id"; }
    public String defaultSort() { return "fullName"; }
    public List<String> requiredFields() { return List.of("fullName", "status"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search users", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "businessUnit", "name", "Business Unit", "type", "LOOKUP"),
                Map.of("code", "profileState", "name", "Access Profile", "type", "LOOKUP"),
                Map.of("code", "lastLoginFrom", "name", "Last sign-in from", "type", "DATE"),
                Map.of("code", "lastLoginTo", "name", "Last sign-in to", "type", "DATE"),
                Map.of("code", "createdFrom", "name", "Created from", "type", "DATE"),
                Map.of("code", "createdTo", "name", "Created to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "u.status", "department", "u.department", "businessUnit", "u.business_unit", "profileState", HAS_PROFILE); }
    public Map<String, String> filterColumns() {
        return Map.of("status", "status", "department", "department", "businessUnit", "businessUnit", "profileState", "profileState", "lastLoginFrom", "lastLoginAt",
                "lastLoginTo", "lastLoginAt", "createdFrom", "createdAt", "createdTo", "createdAt");
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        String grants = ReportQueryKit.grants(actor, scopes, "u.business_unit", "u.department", "(u.id=?)", () -> List.of(actor.getId()), args);
        StringBuilder sql = new StringBuilder("from app_users u where (").append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (u.full_name ilike ? escape '\\' or u.username ilike ? escape '\\' or coalesce(u.employee_code,'') ilike ? escape '\\' or coalesce(u.position,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 4; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "u.status"); equals.put("department", "u.department"); equals.put("businessUnit", "u.business_unit"); equals.put("profileState", HAS_PROFILE);
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "lastLogin", "u.last_login_at::date");
        ReportQueryKit.dates(sql, args, filters, "created", "u.created_at::date");
        return new Query(sql.toString(), args);
    }
}
