package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Matrix Requirements" (REPORT-FIELD-CATALOG-2026-11-15): one line per requirement (row) of each version of the training matrix of a department: the matrix and its version
 * and status, the document or topic that must be trained, whether it is yearly, who it applies to, and who prepared and approved the version. A person needs training.matrix.view; the department
 * scope is the department of the matrix. Never a column: the change and rejection reasons of a version and its content hash.
 */
@Component
public class TrainingMatrixReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("matrix", "Matrix", "m.code");
        column("department", "Department", "dep.name");
        column("versionNo", "Version", "v.version_no");
        column("versionStatus", "Version Status", "initcap(lower(v.status))");
        column("rowNo", "Row", "r.row_no");
        column("requirement", "Required Training", "coalesce(d.document_number || ' ' || d.document_name, r.topic_text)");
        column("annual", "Annual", ReportQueryKit.yesNo("r.annual_required"));
        column("appliesTo", "Applies To", "case when r.all_employees then 'All employees' else (select count(*) || ' positions' from training_matrix_cells c where c.row_id=r.id) end");
        group("Requirement", "rowGroup", "Group", "r.row_group");
        group("Requirement", "documentNumber", "Document Number", "d.document_number");
        group("Requirement", "topic", "Topic", "r.topic_text");
        group("Requirement", "positionCount", "Number of Positions", "(select count(*) from training_matrix_cells c where c.row_id=r.id)");
        group("Requirement", "locked", "Locked", ReportQueryKit.yesNo("r.locked"));
        group("Requirement", "note", "Note", "r.note");
        group("Version", "preparedBy", "Prepared By", ReportQueryKit.person("v.prepared_by"));
        group("Version", "submittedAt", "Submitted At", ReportQueryKit.timestamp("v.submitted_at"));
        group("Version", "approvedBy", "Approved By", ReportQueryKit.person("v.approved_by"));
        group("Version", "approvedAt", "Approved At", ReportQueryKit.timestamp("v.approved_at"));
        group("Version", "effectiveAt", "Effective At", ReportQueryKit.timestamp("v.effective_at"));
        group("Version", "currentVersion", "Current Version", ReportQueryKit.yesNo("m.current_version_id = v.id"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "versionStatus", "department", "annual", "effectiveFrom", "effectiveTo");

    private final TrainingAccess access;

    public TrainingMatrixReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_MATRIX"; }
    public String name() { return "Training Matrix Requirements"; }
    public String category() { return "Training"; }
    public String description() { return "The requirements of each version of a department's training matrix: the document or topic, yearly or not, who it applies to, and who prepared and approved the version."; }
    public List<String> usePermissions() { return List.of("training.matrix.view"); }
    public List<String> allowedScopes() { return List.of("DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("submittedAt", "approvedAt", "effectiveAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "r.id"; }
    public String defaultSort() { return "matrix"; }
    public List<String> requiredFields() { return List.of("matrix", "requirement"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search matrix requirements", "type", "TEXT"),
                Map.of("code", "versionStatus", "name", "Version Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "annual", "name", "Annual", "type", "LOOKUP"),
                Map.of("code", "effectiveFrom", "name", "Effective from", "type", "DATE"),
                Map.of("code", "effectiveTo", "name", "Effective to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() {
        return Map.of("versionStatus", "v.status", "department", "dep.id", "annual", "case when r.annual_required then 'YES' else 'NO' end");
    }
    public Map<String, String> filterColumns() { return Map.of("versionStatus", "versionStatus", "department", "department", "annual", "annual", "effectiveFrom", "effectiveAt", "effectiveTo", "effectiveAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "dep.name");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own, new ReportQueryKit.Cond("false", List.of()), args);
        StringBuilder sql = new StringBuilder("""
                from training_matrix_rows r join training_matrix_versions v on v.id=r.version_id join training_matrices m on m.id=v.matrix_id
                left join departments dep on dep.id=m.department_id left join documents d on d.id=r.document_id where (
                """).append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (m.code ilike ? escape '\\' or coalesce(d.document_number,'') ilike ? escape '\\' or coalesce(d.document_name,'') ilike ? escape '\\' or coalesce(r.topic_text,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 4; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("versionStatus", "v.status"); equals.put("department", "dep.id"); equals.put("annual", "case when r.annual_required then 'YES' else 'NO' end");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "effective", "v.effective_at::date");
        return new Query(sql.toString(), args);
    }
}
