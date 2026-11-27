package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Job Assignments" (REPORT-FIELD-CATALOG-2026-11-15): the job assignments of people (the Job Roles each person holds): the person, the case, the department and
 * position, the status, who assigned it and when it took effect. Same visibility as the Training records: your own, your department, or all departments for whoever may see them.
 * Never a column: the signatures, the completion snapshot of the matrix and what the person held before.
 */
@Component
public class TrainingJobAssignmentReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("issueNo", "Issue Number", "a.issue_no");
        column("person", "Person", ReportQueryKit.person("a.person_user_id"));
        column("employeeCode", "Employee Code", "(select pu.employee_code from app_users pu where pu.id=a.person_user_id)");
        column("jobRoles", "Job Roles", "coalesce((select string_agg(jr.name, '; ' order by x.sort_order) from training_job_assignment_roles x join training_job_roles jr on jr.id=x.job_role_id where x.assignment_id=a.id), '')");
        column("department", "Department", "dep.name");
        column("position", "Position", "pos.name");
        column("caseType", "Case", "initcap(replace(lower(a.case_type), '_', ' '))");
        column("status", "Status", "initcap(replace(lower(a.status), '_', ' '))");
        column("effectiveAt", "Effective At", ReportQueryKit.timestamp("a.effective_at"));
        group("People", "assignor", "Assigned By", ReportQueryKit.person("a.assignor_user_id"));
        group("People", "assignorTitle", "Assignor Title", "a.assignor_title");
        group("People", "directSuperior", "Direct Superior", "a.direct_superior_title");
        group("People", "subordinates", "Subordinates", "a.subordinate_titles");
        group("People", "substitute", "Substitute", "a.substitute_title");
        group("Change", "previousDepartment", "Previous Department", "(select pd.name from departments pd where pd.id=a.previous_department_id)");
        group("Change", "previousPosition", "Previous Position", "(select pp.name from positions pp where pp.id=a.previous_position_id)");
        group("Change", "changeReason", "Change Reason", "a.change_reason");
        group("Change", "exceptionReason", "Exception Reason", "a.exception_reason");
        group("Change", "cancelReason", "Cancel Reason", "a.cancel_reason");
        group("Dates", "createdAt", "Created At", ReportQueryKit.timestamp("a.created_at"));
        group("Dates", "updatedAt", "Last Updated", ReportQueryKit.timestamp("a.updated_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }
    @Override public Set<String> sensitiveFields() { return Set.of("changeReason", "exceptionReason", "cancelReason"); }

    private static final Set<String> FILTERS = Set.of("search", "status", "caseType", "department", "effectiveFrom", "effectiveTo");

    private final TrainingAccess access;

    public TrainingJobAssignmentReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_JOB_ASSIGNMENTS"; }
    public String name() { return "Training Job Assignments"; }
    public String category() { return "Training"; }
    public String description() { return "Job assignments of people: the person, the job roles, the department and position, the case, the status and when it took effect."; }
    public List<String> usePermissions() { return List.of("training.job_assignment.view"); }
    public List<String> allowedScopes() { return List.of("PERSONAL", "DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("effectiveAt", "createdAt", "updatedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "a.id"; }
    public String defaultSort() { return "effectiveAt"; }
    public List<String> requiredFields() { return List.of("person", "status"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search job assignments", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "caseType", "name", "Case", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "effectiveFrom", "name", "Effective from", "type", "DATE"),
                Map.of("code", "effectiveTo", "name", "Effective to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "a.status", "caseType", "a.case_type", "department", "dep.id"); }
    public Map<String, String> filterColumns() { return Map.of("status", "status", "caseType", "caseType", "department", "department", "effectiveFrom", "effectiveAt", "effectiveTo", "effectiveAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "dep.name");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own,
                new ReportQueryKit.Cond("a.person_user_id=?", List.of(actor.getId())), args);
        StringBuilder sql = new StringBuilder("""
                from training_job_assignments a left join departments dep on dep.id=a.department_id left join positions pos on pos.id=a.position_id where (
                """).append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(" + ReportQueryKit.person("a.person_user_id") + ") like eqms_fold(?) escape '\\' or eqms_fold(coalesce(pos.name,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(dep.name,'')) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 3; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "a.status"); equals.put("caseType", "a.case_type"); equals.put("department", "dep.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "effective", "a.effective_at::date");
        return new Query(sql.toString(), args);
    }
}
