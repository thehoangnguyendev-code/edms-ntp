package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Document Register": the controlled documents with their number, name, status, type, department, business unit, people and dates
 * (REPORT-DOCUMENT-SOURCES-2026-11-12 added the revision, author, owner, validity, periodic review, training and language columns). Metadata only: never the
 * file, the description or the signed content. The data scopes of the template decide which documents a person sees.
 */
@Component
public class DocumentReportMetadataProvider implements ReportMetadataProvider {
    private final DocumentReportVisibility visibility;

    public DocumentReportMetadataProvider(DocumentReportVisibility visibility) { this.visibility = visibility; }

    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("documentNumber", "Document Number", "d.document_number");
        column("documentName", "Document Name", "d.document_name");
        column("status", "Status", "s.label");
        column("department", "Department", "dep.name");
        column("businessUnit", "Business Unit", "bu.name");
        column("effectiveDate", "Effective Date", "d.effective_date");
        column("createdAt", "Created", ReportQueryKit.timestamp("d.created_at"));
        column("documentType", "Document Type", "dt.name");
        column("subType", "Sub Type", "d.sub_type");
        column("revision", "Current Revision", "d.version");
        column("author", "Author", "au.full_name");
        column("owner", "Owner", "ou.full_name");
        column("validUntil", "Valid Until", "d.valid_until");
        column("reviewDate", "Next Periodic Review", "d.review_date");
        column("daysToReview", "Days To Review", "case when d.review_date is null then null else d.review_date - current_date end");
        // Overdue: the review date is before the day of the run. Upcoming: it is that day or later. Empty when the document has no review date.
        column("reviewStatus", "Review Status", "case when d.review_date is null then null when d.review_date < current_date then 'Overdue' else 'Upcoming' end");
        column("reviewCycle", "Periodic Review Cycle (Months)", "d.periodic_review_cycle");
        column("requiresTraining", "Training Required", "case when d.requires_training then 'Yes' else 'No' end");
        column("language", "Language", "d.language");
        column("updatedAt", "Last Updated", ReportQueryKit.timestamp("d.updated_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "status", "department", "businessUnit", "documentType", "createdFrom", "createdTo",
            "effectiveFrom", "effectiveTo", "reviewFrom", "reviewTo", "reviewWithinDays", "validUntilFrom", "validUntilTo");

    public String code() { return "DOCUMENT_STATUS"; }
    public String name() { return "Document Register"; }
    public String description() { return "Controlled documents with their number, name, status, type, department, business unit, people, validity and periodic review dates."; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("effectiveDate", "createdAt", "validUntil", "reviewDate", "updatedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "d.id"; }
    public String defaultSort() { return "documentNumber"; }
    public List<String> requiredFields() { return List.of("documentNumber", "documentName"); }
    public List<Map<String,String>> filters() { return List.of(
            Map.of("code", "search", "name", "Search documents", "type", "TEXT"),
            Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
            Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
            Map.of("code", "businessUnit", "name", "Business Unit", "type", "LOOKUP"),
            Map.of("code", "documentType", "name", "Document Type", "type", "LOOKUP"),
            Map.of("code", "createdFrom", "name", "Created from", "type", "DATE"),
            Map.of("code", "createdTo", "name", "Created to", "type", "DATE"),
            Map.of("code", "effectiveFrom", "name", "Effective from", "type", "DATE"),
            Map.of("code", "effectiveTo", "name", "Effective to", "type", "DATE"),
            Map.of("code", "reviewFrom", "name", "Next review from", "type", "DATE"),
            Map.of("code", "reviewTo", "name", "Next review to", "type", "DATE"),
            Map.of("code", "reviewWithinDays", "name", "Review due within (days)", "type", "NUMBER"),
            Map.of("code", "validUntilFrom", "name", "Valid until from", "type", "DATE"),
            Map.of("code", "validUntilTo", "name", "Valid until to", "type", "DATE")); }
    public Map<String,String> lookupColumns() { return Map.of("status", "d.status_code", "department", "dep.id", "businessUnit", "bu.id", "documentType", "dt.id"); }
    public Map<String,String> filterColumns() {
        Map<String, String> columns = new HashMap<>(Map.of("status", "status", "department", "department", "businessUnit", "businessUnit", "documentType", "documentType",
                "createdFrom", "createdAt", "createdTo", "createdAt", "effectiveFrom", "effectiveDate", "effectiveTo", "effectiveDate"));
        columns.putAll(Map.of("reviewFrom", "reviewDate", "reviewTo", "reviewDate", "reviewWithinDays", "reviewDate", "validUntilFrom", "validUntil", "validUntilTo", "validUntil"));
        return columns;
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        String grants = ReportQueryKit.grants(actor, scopes, "bu.name", "dep.name", """
                (d.author_user_id=? or exists(select 1 from document_workflow_participants p where p.document_id=d.id and p.user_id=?)
                or exists(select 1 from revision_workflow_participants p join document_revisions rev on rev.id=p.revision_id where rev.document_id=d.id and p.user_id=?))
                """, () -> List.of(actor.getId(), actor.getId(), actor.getId()), args);
        StringBuilder sql = new StringBuilder("""
                from documents d join document_statuses s on s.code=d.status_code
                join departments dep on dep.id=d.department_id join business_units bu on bu.id=d.business_unit_id
                join document_types dt on dt.id=d.document_type_id
                left join app_users au on au.id=d.author_user_id left join app_users ou on ou.id=d.owner_user_id where (
                """).append(grants).append(")");
        // REPORT-DC-VISIBILITY-2026-11-12: only what the Document Control list shows the same person.
        ReportQueryKit.and(sql, args, visibility.documents(actor, "d"));
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (d.document_number ilike ? escape '\\' or d.document_name ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            args.add(term); args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "d.status_code"); equals.put("department", "dep.id"); equals.put("businessUnit", "bu.id"); equals.put("documentType", "dt.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "created", "d.created_at::date");
        ReportQueryKit.dates(sql, args, filters, "effective", "d.effective_date");
        ReportQueryKit.dates(sql, args, filters, "review", "d.review_date");
        // Relative to the day of the run: a document whose next review falls within N days, or that is already overdue. Documents with no review date are not listed.
        String within = ReportQueryKit.text(filters.get("reviewWithinDays"));
        if (!within.isBlank()) {
            int days;
            try { days = Integer.parseInt(within); } catch (NumberFormatException invalid) { throw new IllegalArgumentException("REPORT_REVIEW_DAYS_INVALID"); }
            if (days < 0 || days > 3650) throw new IllegalArgumentException("REPORT_REVIEW_DAYS_INVALID");
            sql.append(" and d.review_date is not null and d.review_date <= current_date + ?");
            args.add(days);
        }
        ReportQueryKit.dates(sql, args, filters, "validUntil", "d.valid_until");
        return new Query(sql.toString(), args);
    }
}
