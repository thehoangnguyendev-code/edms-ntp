package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Document Revisions" (REPORT-DOCUMENT-SOURCES-2026-11-12): every revision of a controlled document with its status, how long it has been in that
 * status, the people who submitted it, and its training, publishing and validity dates. Metadata only: never the file, the description or the signed content.
 * The data scopes of the template decide which revisions a person sees, as for the Document Register.
 */
@Component
public class RevisionReportMetadataProvider implements ReportMetadataProvider {
    private final DocumentReportVisibility visibility;

    public RevisionReportMetadataProvider(DocumentReportVisibility visibility) { this.visibility = visibility; }

    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("documentNumber", "Document Number", "r.document_number");
        column("documentName", "Document Name", "r.document_name");
        column("revisionNumber", "Revision", "r.revision_number");
        column("status", "Status", "coalesce(rs.label, r.status_code)");
        // Days since the revision entered its present status: the last change of status, or its creation when it has never changed.
        column("daysInStatus", "Days in Status", "greatest(0, current_date - coalesce((select max(h.created_at) from revision_workflow_history h "
                + "where h.revision_id=r.id and h.to_status=r.status_code and h.from_status is distinct from h.to_status), r.created_at)::date)");
        column("documentType", "Document Type", "dt.name");
        column("department", "Department", "dep.name");
        column("businessUnit", "Business Unit", "bu.name");
        column("author", "Author", "au.full_name");
        column("submittedBy", "Submitted By", "su.full_name");
        column("submittedOn", "Submitted On", ReportQueryKit.timestamp("r.submitted_on"));
        column("requiresTraining", "Training Required", "case when r.requires_training then 'Yes' else 'No' end");
        column("trainingNumber", "Training Number", "r.training_number");
        column("trainingCompletionDate", "Training Completed", "r.training_completion_date");
        column("publishedAt", "Published At", ReportQueryKit.timestamp("r.published_at"));
        column("effectiveDate", "Effective Date", "r.effective_date");
        column("validUntil", "Valid Until", "r.valid_until");
        column("createdAt", "Created", ReportQueryKit.timestamp("r.created_at"));
        column("updatedAt", "Last Updated", ReportQueryKit.timestamp("r.updated_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "status", "department", "businessUnit", "documentType", "createdFrom", "createdTo",
            "submittedFrom", "submittedTo", "publishedFrom", "publishedTo", "effectiveFrom", "effectiveTo");

    public String code() { return "DOCUMENT_REVISIONS"; }
    public String name() { return "Document Revisions"; }
    public String description() { return "Revisions of controlled documents with their status, time in status, people, training and validity dates."; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("submittedOn", "trainingCompletionDate", "publishedAt", "effectiveDate", "validUntil", "createdAt", "updatedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "r.id"; }
    public String defaultSort() { return "documentNumber"; }
    public List<String> requiredFields() { return List.of("documentNumber", "revisionNumber"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search revisions", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "businessUnit", "name", "Business Unit", "type", "LOOKUP"),
                Map.of("code", "documentType", "name", "Document Type", "type", "LOOKUP"),
                Map.of("code", "createdFrom", "name", "Created from", "type", "DATE"),
                Map.of("code", "createdTo", "name", "Created to", "type", "DATE"),
                Map.of("code", "submittedFrom", "name", "Submitted from", "type", "DATE"),
                Map.of("code", "submittedTo", "name", "Submitted to", "type", "DATE"),
                Map.of("code", "publishedFrom", "name", "Published from", "type", "DATE"),
                Map.of("code", "publishedTo", "name", "Published to", "type", "DATE"),
                Map.of("code", "effectiveFrom", "name", "Effective from", "type", "DATE"),
                Map.of("code", "effectiveTo", "name", "Effective to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "r.status_code", "department", "dep.id", "businessUnit", "bu.id", "documentType", "dt.id"); }
    public Map<String, String> filterColumns() {
        Map<String, String> columns = new HashMap<>(Map.of("status", "status", "department", "department", "businessUnit", "businessUnit", "documentType", "documentType",
                "createdFrom", "createdAt", "createdTo", "createdAt", "submittedFrom", "submittedOn", "submittedTo", "submittedOn"));
        columns.putAll(Map.of("publishedFrom", "publishedAt", "publishedTo", "publishedAt", "effectiveFrom", "effectiveDate", "effectiveTo", "effectiveDate"));
        return columns;
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        String grants = ReportQueryKit.grants(actor, scopes, "bu.name", "dep.name", """
                (r.author_user_id=? or exists(select 1 from revision_workflow_participants p where p.revision_id=r.id and p.user_id=?)
                or exists(select 1 from document_workflow_participants p where p.document_id=r.document_id and p.user_id=?))
                """, () -> List.of(actor.getId(), actor.getId(), actor.getId()), args);
        // A revision without a department, unit or type is still listed (left joins): a report never drops a record silently.
        StringBuilder sql = new StringBuilder("""
                from document_revisions r left join revision_statuses rs on rs.code=r.status_code
                left join departments dep on dep.id=r.department_id left join business_units bu on bu.id=r.business_unit_id
                left join document_types dt on dt.id=r.document_type_id
                left join app_users au on au.id=r.author_user_id left join app_users su on su.id=r.submitted_by_user_id where (
                """).append(grants).append(")");
        // REPORT-DC-VISIBILITY-2026-11-12: only what the Document Control list shows the same person.
        ReportQueryKit.and(sql, args, visibility.revisions(actor, "r"));
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (r.document_number ilike ? escape '\\' or r.document_name ilike ? escape '\\' or r.revision_number ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            args.add(term); args.add(term); args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "r.status_code"); equals.put("department", "dep.id"); equals.put("businessUnit", "bu.id"); equals.put("documentType", "dt.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "created", "r.created_at::date");
        ReportQueryKit.dates(sql, args, filters, "submitted", "r.submitted_on::date");
        ReportQueryKit.dates(sql, args, filters, "published", "r.published_at::date");
        ReportQueryKit.dates(sql, args, filters, "effective", "r.effective_date");
        return new Query(sql.toString(), args);
    }
}
