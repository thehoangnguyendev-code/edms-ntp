package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import com.eqms.service.training.TrainingComplianceService;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Compliance" (REPORT-TRAINING-SOURCES-2026-11-12): who is trained on what the effective training matrix of the department requires, one row for each person and
 * requirement. The rule is the one of the Compliance screens, taken from {@link TrainingComplianceService#coverageSql}, so a report can never differ from the screen: a requirement is
 * met by a record of the same document or of a topic with the same name that is not voided, and an annual requirement is due again after one year. A person needs
 * training.compliance.view; without training.scope.all only the own department is shown, whatever the scope of the template says.
 */
@Component
public class TrainingComplianceReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("department", "Department", "dep.name");
        column("employeeCode", "Employee Code", "x.employee_code");
        column("fullName", "Employee", "x.full_name");
        column("position", "Job Role", "x.position_name");
        column("requirement", "Required Training", "x.title");
        column("documentNumber", "Document Number", "x.code");
        column("annual", "Annual", "case when x.annual_required then 'Yes' else 'No' end");
        column("lastDone", "Last Trained On", "x.last_done");
        column("status", "Status", ReportQueryKit.labelCase("x.status", "MISSING", "Not trained", "UPDATE_NEEDED", "New revision not trained", "DUE", "Annual training due", "OK", "Trained"));
        column("newEmployee", "New Employee", "case when x.is_new then 'Yes' else 'No' end");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "department", "status", "newEmployee");

    private final TrainingAccess access;

    public TrainingComplianceReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_COMPLIANCE"; }
    public String name() { return "Training Compliance"; }
    public String category() { return "Training"; }
    public String description() { return "Who is trained on what the effective training matrix of the department requires: trained, annual training due, new revision not trained, or not trained."; }
    public List<String> usePermissions() { return List.of("training.compliance.view"); }
    public List<String> allowedScopes() { return List.of("PERSONAL", "DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("lastDone")); }
    public Map<String, String> labels() { return LABELS; }
    /** One row of the screen is one person and one requirement (a row of the matrix); this is a stable id of that pair. */
    public String identityColumn() { return "md5(dep.id::text || ':' || x.pid::text || ':' || x.row_id::text)::uuid"; }
    public String defaultSort() { return "department"; }
    public List<String> requiredFields() { return List.of("fullName", "requirement", "status"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search people and requirements", "type", "TEXT"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "newEmployee", "name", "New Employee", "type", "LOOKUP"));
    }
    public Map<String, String> lookupColumns() { return Map.of("department", "dep.id", "status", "x.status", "newEmployee", "case when x.is_new then 'YES' else 'NO' end"); }
    public Map<String, String> filterColumns() { return Map.of("department", "department", "status", "status", "newEmployee", "newEmployee"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "dep.name");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own,
                new ReportQueryKit.Cond("x.pid=?", List.of(actor.getId())), args);
        // The rule of the screen, for every department; the condition on the department is applied before it runs, so it runs for the departments of the person only.
        StringBuilder sql = new StringBuilder("from departments dep cross join lateral (").append(TrainingComplianceService.coverageSql("dep.id")).append(") x where (")
                .append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(x.full_name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(x.employee_code,'')) like eqms_fold(?) escape '\\' or eqms_fold(x.title) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(x.code,'')) like eqms_fold(?) escape '\\'"
                    + " or eqms_fold(coalesce(x.position_name,'')) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 5; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("department", "dep.id"); equals.put("status", "x.status"); equals.put("newEmployee", "case when x.is_new then 'YES' else 'NO' end");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        return new Query(sql.toString(), args);
    }
}
