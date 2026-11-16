package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Job Roles" (REPORT-FIELD-CATALOG-2026-11-15): the Job Roles (the duties of a position) with their department, position, state, version and the people who hold them.
 * A person needs training.matrix.view; the department scope is the department of the Job Role. Never a column: the jurisdiction and the description (free texts of the role).
 */
@Component
public class TrainingJobRoleReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("code", "Job Role Code", "r.code");
        column("name", "Job Role", "r.name");
        column("department", "Department", "dep.name");
        column("position", "Position", "pos.name");
        column("status", "Status", "case when r.is_active then 'Active' else 'Inactive' end");
        column("version", "Version", "r.version");
        group("Role", "seniorManagement", "Senior Management", ReportQueryKit.yesNo("r.senior_management"));
        group("Role", "holders", "People Holding the Role", "(select count(*) from training_job_assignment_roles x join training_job_assignments a on a.id=x.assignment_id where x.job_role_id=r.id and a.status='ACTIVE')");
        group("Dates", "createdAt", "Created At", ReportQueryKit.timestamp("r.created_at"));
        group("Dates", "updatedAt", "Last Updated", ReportQueryKit.timestamp("r.updated_at"));
        group("People", "createdBy", "Created By", ReportQueryKit.person("r.created_by"));
        group("People", "updatedBy", "Updated By", ReportQueryKit.person("r.updated_by"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "status", "department");

    private final TrainingAccess access;

    public TrainingJobRoleReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_JOB_ROLES"; }
    public String name() { return "Training Job Roles"; }
    public String category() { return "Training"; }
    public String description() { return "Job Roles with their department, position, state, version and how many people hold them."; }
    public List<String> usePermissions() { return List.of("training.matrix.view"); }
    public List<String> allowedScopes() { return List.of("DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("createdAt", "updatedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "r.id"; }
    public String defaultSort() { return "name"; }
    public List<String> requiredFields() { return List.of("code", "name"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search job roles", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "case when r.is_active then 'ACTIVE' else 'INACTIVE' end", "department", "dep.id"); }
    public Map<String, String> filterColumns() { return Map.of("status", "status", "department", "department"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "dep.name");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own, new ReportQueryKit.Cond("false", List.of()), args);
        StringBuilder sql = new StringBuilder("""
                from training_job_roles r left join departments dep on dep.id=r.department_id left join positions pos on pos.id=r.title_position_id where (
                """).append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (r.code ilike ? escape '\\' or r.name ilike ? escape '\\' or coalesce(pos.name,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 3; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "case when r.is_active then 'ACTIVE' else 'INACTIVE' end"); equals.put("department", "dep.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        return new Query(sql.toString(), args);
    }
}
