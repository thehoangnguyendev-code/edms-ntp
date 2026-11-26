package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingAccess;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Training Participants" (REPORT-TRAINING-SOURCES-2026-11-12): one row for each person on the list of a training activity, with the state (invited, attended, read,
 * absent), the result, and the activity they belong to. It answers "who was absent" and "who has not yet done a training that is due". A person needs training.activity.view or
 * training.compliance.view. The Training module's own rule applies on top of the scope of the template: without training.scope.all a person sees the participants of the activities
 * of the own department and the people of the own department in any activity. Never a column: the reasons of absence and of adding a person (free texts about a person).
 */
@Component
public class TrainingParticipantReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("trainingNumber", "Training Number", "a.training_number");
        column("topic", "Training Topic", "training_activity_topics(a.id)");
        column("documentNumber", "Document Number", "a.document_number");
        column("revisionNumber", "Revision", "a.revision_number");
        column("employeeCode", "Employee Code", "p.employee_code");
        column("fullName", "Participant", "coalesce(p.full_name, p.external_name)");
        column("organisation", "Organization (External)", "p.external_org");
        column("department", "Department", "p.department");
        column("position", "Position", "p.position");
        column("participationRole", "Participation", ReportQueryKit.labelCase("p.participation_role", "TRAINEE", "Trainee", "ATTENDEE", "Attends, no assessment",
                "NAME_ONLY", "Listed only, does not sign"));
        column("state", "State", ReportQueryKit.labelCase("p.state", "INVITED", "Invited", "ATTENDED", "Attended", "ONLINE", "Online", "ABSENT", "Absent",
                "READ_CONFIRMED", "Read and confirmed"));
        column("result", "Result", ReportQueryKit.labelCase("p.result", "PENDING", "Pending", "PASSED", "Qualified", "FAILED", "Not qualified"));
        column("activityStatus", "Activity Status", ReportQueryKit.labelCase("a.status", "RESERVED", "Pending Document Approval", "PLANNED", "Planned", "PENDING_APPROVAL", "Pending Approval", "NOTIFIED", "Notified",
                "IN_PROGRESS", "In Progress", "PENDING_QA_CONFIRMATION", "Pending QA Confirmation", "COMPLETED", "Completed", "CANCELLED", "Closed - Cancelled"));
        column("organizer", "Organizing Department", "dep.name");
        column("dueDate", "Due Date", "a.due_date");
        column("daysOverdue", "Days Overdue", "case when a.status in ('PLANNED','PENDING_APPROVAL','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION') and p.state in ('INVITED','ABSENT') "
                + "and a.due_date < current_date then current_date - a.due_date else 0 end");
        column("notifiedAt", "Notified At", ReportQueryKit.timestamp("p.notified_at"));
        column("readConfirmedAt", "Read Confirmed At", ReportQueryKit.timestamp("p.read_confirmed_at"));
        column("addedAt", "Added At", ReportQueryKit.timestamp("p.created_at"));
        // REPORT-FIELD-CATALOG-2026-11-15: more of the metadata the source holds.
        group("Attendance", "absenceReason", "Absence Reason", "p.absence_reason");
        group("Attendance", "plannedAbsence", "Planned Absence", "p.planned_absence");
        group("Attendance", "addedReason", "Reason Added", "p.added_reason");
        group("Attendance", "signMode", "Sign Mode", "p.sign_mode");
        group("Participation", "participationReason", "Participation Reason", "p.participation_reason");
        group("Participation", "participationSetBy", "Participation Set By", ReportQueryKit.person("p.participation_set_by"));
        group("Participation", "participationSetAt", "Participation Set At", ReportQueryKit.timestamp("p.participation_set_at"));
        group("Reminders", "lastReadReminderAt", "Last Read Reminder", ReportQueryKit.timestamp("p.last_read_reminder_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }
    @Override public Set<String> sensitiveFields() { return Set.of("absenceReason", "plannedAbsence", "addedReason", "participationReason"); }

    private static final Set<String> FILTERS = Set.of("search", "state", "result", "activityStatus", "department", "dueFrom", "dueTo", "addedFrom", "addedTo");

    private final TrainingAccess access;

    public TrainingParticipantReportMetadataProvider(TrainingAccess access) { this.access = access; }

    public String code() { return "TRAINING_PARTICIPANTS"; }
    public String name() { return "Training Participants"; }
    public String category() { return "Training"; }
    public String description() { return "People on the list of a training activity with their state (invited, attended, read, absent), result and the activity they belong to."; }
    public List<String> usePermissions() { return List.of("training.activity.view", "training.compliance.view"); }
    public List<String> allowedScopes() { return List.of("PERSONAL", "DEPARTMENT", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("dueDate", "notifiedAt", "readConfirmedAt", "addedAt", "participationSetAt", "lastReadReminderAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "p.id"; }
    public String defaultSort() { return "trainingNumber"; }
    public List<String> requiredFields() { return List.of("trainingNumber", "fullName"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search participants", "type", "TEXT"),
                Map.of("code", "state", "name", "State", "type", "LOOKUP"),
                Map.of("code", "result", "name", "Result", "type", "LOOKUP"),
                Map.of("code", "activityStatus", "name", "Activity Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "dueFrom", "name", "Due from", "type", "DATE"),
                Map.of("code", "dueTo", "name", "Due to", "type", "DATE"),
                Map.of("code", "addedFrom", "name", "Added from", "type", "DATE"),
                Map.of("code", "addedTo", "name", "Added to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("state", "p.state", "result", "p.result", "activityStatus", "a.status", "department", "p.department"); }
    public Map<String, String> filterColumns() {
        return Map.of("state", "state", "result", "result", "activityStatus", "activityStatus", "department", "department", "dueFrom", "dueDate", "dueTo", "dueDate",
                "addedFrom", "addedAt", "addedTo", "addedAt");
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        var own = ReportQueryKit.ownDepartment(actor, "dep.name", "p.department");
        String grants = ReportQueryKit.grantsOf(actor, scopes, access.allDepartments(actor) ? ReportQueryKit.EVERYTHING : own, own,
                new ReportQueryKit.Cond("p.person_user_id=?", List.of(actor.getId())), args);
        StringBuilder sql = new StringBuilder("""
                from training_participants p join training_activities a on a.id=p.activity_id left join departments dep on dep.id=a.organizer_department_id where (
                """).append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (coalesce(p.full_name, p.external_name,'') ilike ? escape '\\' or coalesce(p.employee_code,'') ilike ? escape '\\' or a.training_number ilike ? escape '\\'"
                    + " or training_activity_topics(a.id) ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 4; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("state", "p.state"); equals.put("result", "p.result"); equals.put("activityStatus", "a.status"); equals.put("department", "p.department");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "due", "a.due_date");
        ReportQueryKit.dates(sql, args, filters, "added", "p.created_at::date");
        return new Query(sql.toString(), args);
    }
}
