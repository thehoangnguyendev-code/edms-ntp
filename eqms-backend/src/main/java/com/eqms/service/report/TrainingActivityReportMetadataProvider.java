package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Activities" (REPORT-TRAINING-SOURCES-2026-11-12): the training activities with their number, topic, kind, status, organizing department, due date, how late
 * they are, and how many people were invited, attended, were absent, qualified or not qualified. A person needs training.activity.view or training.compliance.view, as for the screens.
 * The Training module's own rule applies on top of the scope of the template: without training.scope.all only the activities of the own department are shown.
 * Never a column: the free texts (remarks, reasons of cancellation, exemptions).
 */
@Component
public class TrainingActivityReportMetadataProvider implements ReportMetadataProvider {
    /** The statuses in which an activity still has work to do; a due date in the past makes it late. */
    private static final String OPEN = "a.status in ('PLANNED','PENDING_APPROVAL','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION')";
    private static final String PRESENT = "p.state in ('ATTENDED','ONLINE','READ_CONFIRMED')";
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("trainingNumber", "Training Number", "a.training_number");
        column("topic", "Training Topic", "training_activity_topics(a.id)");
        column("kind", "Kind", ReportQueryKit.labelCase("a.kind", "INITIAL", "Initial Training", "PERIODIC", "Periodic Training", "UNPLANNED", "Unplanned Training",
                "RETRAINING", "Supplementary Training", "EXTERNAL", "External Training", "LEGACY", "Paper Training (Legacy Import)"));
        column("kindReason", "Reason for the Training", ReportQueryKit.labelCase("a.kind_reason", "NEW_HIRE", "New hire", "TRANSFER", "Transfer", "NEW_SOP", "New SOP",
                "SOP_VERSION", "New version of an SOP", "CAPA", "CAPA", "AUDIT_FINDING", "Audit finding", "VISITOR", "Visitor", "ABSENCE_RETURN", "Return after absence",
                "ABSENT_MAKEUP", "Supplementary for absence", "FAILED_ASSESSMENT", "Not qualified, retraining", "OTHER", "Other"));
        column("status", "Status", ReportQueryKit.labelCase("a.status", "RESERVED", "Pending Document Approval", "PLANNED", "Planned", "PENDING_APPROVAL", "Pending Approval", "NOTIFIED", "Notified",
                "IN_PROGRESS", "In Progress", "PENDING_QA_CONFIRMATION", "Pending QA Confirmation", "COMPLETED", "Completed", "CANCELLED", "Closed - Cancelled"));
        column("department", "Organizing Department", "dep.name");
        column("documentNumber", "Document Number", "a.document_number");
        column("documentName", "Document Name", "a.document_name");
        column("revisionNumber", "Revision", "a.revision_number");
        column("approvedOn", "Approved On", "a.approved_on");
        column("dueDate", "Due Date", "a.due_date");
        column("completedOn", "Completed On", "a.completed_on");
        column("daysOverdue", "Days Overdue", "case when " + OPEN + " and a.due_date < current_date then current_date - a.due_date else 0 end");
        column("sessions", "Sessions", "(select count(*) from training_sessions s where s.activity_id=a.id and s.status <> 'CANCELLED')");
        column("participants", "Participants", "(select count(*) from training_participants p where p.activity_id=a.id)");
        column("attended", "Attended or Read", "(select count(*) from training_participants p where p.activity_id=a.id and " + PRESENT + ")");
        column("absent", "Absent", "(select count(*) from training_participants p where p.activity_id=a.id and p.state='ABSENT')");
        column("passed", "Qualified", "(select count(*) from training_participants p where p.activity_id=a.id and p.result='PASSED')");
        column("failed", "Not qualified", "(select count(*) from training_participants p where p.activity_id=a.id and p.result='FAILED')");
        column("createdBy", "Created By", "cb.full_name");
        column("createdAt", "Created At", ReportQueryKit.timestamp("a.created_at"));
        column("confirmedAt", "Confirmed At", ReportQueryKit.timestamp("a.confirmed_at"));
        // REPORT-FIELD-CATALOG-2026-11-15: more of the metadata the source holds.
        group("Plan", "trainingPeriodDays", "Training Period (Days)", "a.training_period_days");
        group("Plan", "externalType", "External Training Type", "a.external_type");
        group("Plan", "remarks", "Remarks", "a.remarks");
        group("Plan", "cancelReason", "Cancel Reason", "a.cancel_reason");
        group("Plan", "updatedAt", "Last Updated", ReportQueryKit.timestamp("a.updated_at"));
        group("Training Unit", "trainingUnit", "Training Unit", "a.training_unit_name");
        group("Training Unit", "vendorRef", "Vendor Reference", "a.vendor_ref");
        group("Assessment", "examMinutes", "Exam Minutes", "a.exam_minutes");
        group("Assessment", "assessmentName", "Assessment", "a.assessment_name");
        group("Assessment", "assessmentKind", "Assessment Kind", "a.assessment_kind");
        group("Assessment", "assessmentMaxScore", "Assessment Maximum Score", "a.assessment_max_score");
        group("Assessment", "materialsExempt", "Materials Exempt", ReportQueryKit.yesNo("a.materials_exempt"));
        group("Assessment", "materialsExemptReason", "Materials Exemption Reason", "a.materials_exempt_reason");
        group("Assessment", "assessmentExempt", "Assessment Exempt", ReportQueryKit.yesNo("a.assessment_exempt"));
        group("Assessment", "assessmentExemptReason", "Assessment Exemption Reason", "a.assessment_exempt_reason");
        group("Paper Session", "paperTopic", "Paper Session Topic", "a.paper_topic");
        group("Paper Session", "paperTrainer", "Paper Session Trainer", "a.paper_trainer");
        group("Paper Session", "paperMethod", "Paper Session Method", "a.paper_method");
        group("Stages", "impactAssessedAt", "Impact Assessed At", ReportQueryKit.timestamp("a.impact_assessed_at"));
        group("Stages", "impactAssessedBy", "Impact Assessed By", ReportQueryKit.person("a.impact_assessed_by"));
        group("Stages", "confirmedBy", "Confirmed By", ReportQueryKit.person("a.confirmed_by"));
        group("Stages", "attendanceSentAt", "Attendance Sent At", ReportQueryKit.timestamp("a.attendance_sent_at"));
        group("Stages", "attendanceSentBy", "Attendance Sent By", ReportQueryKit.person("a.attendance_sent_by"));
        group("Stages", "resultsFinishedAt", "Results Finished At", ReportQueryKit.timestamp("a.results_finished_at"));
        group("Stages", "resultsFinishedBy", "Results Finished By", ReportQueryKit.person("a.results_finished_by"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "status", "kind", "department", "dueFrom", "dueTo", "createdFrom", "createdTo", "completedFrom", "completedTo");

    private final TrainingAccess access;

    public TrainingActivityReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_ACTIVITIES"; }
    public String name() { return "Training Activities"; }
    public String category() { return "Training"; }
    public String description() { return "Training activities with their kind, status, organizing department, due date, days overdue and the number of people who attended, were absent, qualified or not qualified."; }
    public List<String> usePermissions() { return List.of("training.activity.view", "training.compliance.view"); }
    public List<String> allowedScopes() { return List.of("PERSONAL", "DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("approvedOn", "dueDate", "completedOn", "createdAt", "confirmedAt", "updatedAt", "impactAssessedAt", "attendanceSentAt", "resultsFinishedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "a.id"; }
    public String defaultSort() { return "trainingNumber"; }
    public List<String> requiredFields() { return List.of("trainingNumber", "status"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search training activities", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "kind", "name", "Kind", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Organizing Department", "type", "LOOKUP"),
                Map.of("code", "dueFrom", "name", "Due from", "type", "DATE"),
                Map.of("code", "dueTo", "name", "Due to", "type", "DATE"),
                Map.of("code", "createdFrom", "name", "Created from", "type", "DATE"),
                Map.of("code", "createdTo", "name", "Created to", "type", "DATE"),
                Map.of("code", "completedFrom", "name", "Completed from", "type", "DATE"),
                Map.of("code", "completedTo", "name", "Completed to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "a.status", "kind", "a.kind", "department", "dep.id"); }
    public Map<String, String> filterColumns() {
        return Map.of("status", "status", "kind", "kind", "department", "department", "dueFrom", "dueDate", "dueTo", "dueDate", "createdFrom", "createdAt", "createdTo", "createdAt",
                "completedFrom", "completedOn", "completedTo", "completedOn");
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "dep.name");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own,
                new ReportQueryKit.Cond("(a.created_by=? or exists(select 1 from training_participants pp where pp.activity_id=a.id and pp.person_user_id=?))",
                        List.of(actor.getId(), actor.getId())), args);
        StringBuilder sql = new StringBuilder("""
                from training_activities a left join departments dep on dep.id=a.organizer_department_id left join app_users cb on cb.id=a.created_by where (
                """).append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(a.training_number) like eqms_fold(?) escape '\\' or eqms_fold(training_activity_topics(a.id)) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(a.document_number,'')) like eqms_fold(?) escape '\\'"
                    + " or eqms_fold(coalesce(a.document_name,'')) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 4; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "a.status"); equals.put("kind", "a.kind"); equals.put("department", "dep.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "due", "a.due_date");
        ReportQueryKit.dates(sql, args, filters, "created", "a.created_at::date");
        ReportQueryKit.dates(sql, args, filters, "completed", "a.completed_on");
        return new Query(sql.toString(), args);
    }
}
