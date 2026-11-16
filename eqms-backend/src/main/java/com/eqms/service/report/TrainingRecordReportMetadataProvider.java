package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Records" (REPORT-TRAINING-SOURCES-2026-11-12): the training records of people, as the Training Records screen lists them, with the record that voids
 * one. A person needs training.record.view, as for the screen. The Training module's own rule applies on top of the scope of the template: a person who cannot see all
 * departments (training.scope.all) sees the records of the own department only, whatever the scope of the template says. Never a column: the hash of the content.
 */
@Component
public class TrainingRecordReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("trainingNumber", "Training Number", "r.training_number");
        column("topic", "Training Topic", "r.topic_text");
        column("documentNumber", "Document Number", "r.document_number");
        column("documentRevision", "Document Revision", "r.document_revision");
        column("completedOn", "Completed On", "r.completed_on");
        column("method", "Method", ReportQueryKit.labelCase("r.method", "SELF_READING", "Self-reading", "CLASSROOM", "Classroom training", "HYBRID", "Hybrid training",
                "PRACTICAL", "Practical training", "EXTERNAL", "External training", "PAPER", "Paper training", "SIGNATORY", "Reading by a signatory"));
        column("result", "Result", ReportQueryKit.labelCase("r.result", "PASSED", "Passed", "READ", "Read and understood", "ATTENDED", "Attended", "TRAINER", "Trainer"));
        column("source", "Source", ReportQueryKit.labelCase("r.source", "ACTIVITY", "Training activity", "LEGACY_IMPORT", "Legacy import", "SIGNATORY_INITIAL", "Signatory (initial)"));
        column("employeeCode", "Employee Code", "r.employee_code");
        column("fullName", "Employee", "r.full_name");
        column("department", "Department", "r.department");
        column("position", "Position", "r.position");
        column("recordedAt", "Recorded At", ReportQueryKit.timestamp("r.created_at"));
        column("recordNumber", "Record Number", "r.record_no");
        column("recordStatus", "Record Status", "case when v.id is null then 'Valid' else 'Voided' end");
        column("voidedAt", "Voided At", ReportQueryKit.timestamp("v.voided_at"));
        column("voidedBy", "Voided By", "vb.full_name");
        column("voidReason", "Void Reason", "v.reason");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "method", "result", "source", "department", "recordStatus", "completedFrom", "completedTo", "recordedFrom", "recordedTo");

    private final TrainingAccess access;

    public TrainingRecordReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_RECORDS"; }
    public String name() { return "Training Records"; }
    public String category() { return "Training"; }
    public String description() { return "Training records of people: the training, the document and revision, the date, the method and result, and whether the record is voided."; }
    public List<String> usePermissions() { return List.of("training.record.view"); }
    public List<String> allowedScopes() { return List.of("PERSONAL", "DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("completedOn", "recordedAt", "voidedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "r.id"; }
    public String defaultSort() { return "completedOn"; }
    public List<String> requiredFields() { return List.of("trainingNumber", "fullName"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search training records", "type", "TEXT"),
                Map.of("code", "method", "name", "Method", "type", "LOOKUP"),
                Map.of("code", "result", "name", "Result", "type", "LOOKUP"),
                Map.of("code", "source", "name", "Source", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "recordStatus", "name", "Record Status", "type", "LOOKUP"),
                Map.of("code", "completedFrom", "name", "Completed from", "type", "DATE"),
                Map.of("code", "completedTo", "name", "Completed to", "type", "DATE"),
                Map.of("code", "recordedFrom", "name", "Recorded from", "type", "DATE"),
                Map.of("code", "recordedTo", "name", "Recorded to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() {
        return Map.of("method", "r.method", "result", "r.result", "source", "r.source", "department", "r.department", "recordStatus", "case when v.id is null then 'VALID' else 'VOIDED' end");
    }
    public Map<String, String> filterColumns() {
        return Map.of("method", "method", "result", "result", "source", "source", "department", "department", "recordStatus", "recordStatus", "completedFrom", "completedOn",
                "completedTo", "completedOn", "recordedFrom", "recordedAt", "recordedTo", "recordedAt");
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "r.department");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own,
                new ReportQueryKit.Cond("r.person_user_id=?", List.of(actor.getId())), args);
        StringBuilder sql = new StringBuilder("""
                from training_records r left join training_record_voids v on v.record_id=r.id left join app_users vb on vb.id=v.voided_by where (
                """).append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (r.topic_text ilike ? escape '\\' or r.training_number ilike ? escape '\\' or coalesce(r.document_number,'') ilike ? escape '\\'"
                    + " or r.full_name ilike ? escape '\\' or coalesce(r.employee_code,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 5; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("method", "r.method"); equals.put("result", "r.result"); equals.put("source", "r.source"); equals.put("department", "r.department");
        equals.put("recordStatus", "case when v.id is null then 'VALID' else 'VOIDED' end");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "completed", "r.completed_on");
        ReportQueryKit.dates(sql, args, filters, "recorded", "r.created_at::date");
        return new Query(sql.toString(), args);
    }
}
