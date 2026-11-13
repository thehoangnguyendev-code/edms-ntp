package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Uncontrolled Copies" (REPORT-DOCUMENT-SOURCES-2026-11-12): the uncontrolled (reference) copies with their number, document, status, people and dates.
 * Metadata only: never the file, its checksum, the rejection or cancellation text. The department and business unit are those of the document.
 */
@Component
public class UncontrolledCopyReportMetadataProvider implements ReportMetadataProvider {
    private final DocumentReportVisibility visibility;

    public UncontrolledCopyReportMetadataProvider(DocumentReportVisibility visibility) { this.visibility = visibility; }

    /** The label of a status code; a code that is not known is shown as it is. */
    private static final String STATUS_LABEL = "case uc.status_code when 'REQUESTED' then 'Requested' when 'APPROVED' then 'Approved' when 'REJECTED' then 'Rejected' "
            + "when 'GENERATED' then 'Generated' when 'DISTRIBUTED' then 'Distributed' when 'CANCELLED' then 'Cancelled' when 'EXPIRED' then 'Expired' else uc.status_code end";
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("copyNumber", "Uncontrolled Copy Number", "uc.uncontrolled_copy_number");
        column("documentNumber", "Document Number", "uc.document_number");
        column("documentTitle", "Document Name", "uc.document_title");
        column("revisionNumber", "Revision", "uc.revision_number");
        column("status", "Status", STATUS_LABEL);
        column("documentType", "Document Type", "dt.name");
        column("department", "Department", "dep.name");
        column("businessUnit", "Business Unit", "bu.name");
        column("reason", "Reason", "uc.reason");
        column("requestedBy", "Requested By", "rq.full_name");
        column("requestedAt", "Requested At", ReportQueryKit.timestamp("uc.requested_at"));
        column("approvedBy", "Approved By", "ap.full_name");
        column("approvedAt", "Approved At", ReportQueryKit.timestamp("uc.approved_at"));
        column("generatedAt", "Generated At", ReportQueryKit.timestamp("uc.generated_at"));
        column("distributedAt", "Distributed At", ReportQueryKit.timestamp("uc.distributed_at"));
        column("recipient", "Recipient", "ru.full_name");
        column("validUntil", "Valid Until", "uc.valid_until");
        column("downloadCount", "Downloads", "uc.download_count");
        column("lastDownloadedAt", "Last Downloaded", ReportQueryKit.timestamp("uc.last_downloaded_at"));
        column("createdAt", "Created", ReportQueryKit.timestamp("uc.created_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "status", "department", "businessUnit", "requestedFrom", "requestedTo", "distributedFrom", "distributedTo");

    public String code() { return "UNCONTROLLED_COPIES"; }
    public String name() { return "Uncontrolled Copies"; }
    public String description() { return "Uncontrolled copies with their document, status, requester, approver, recipient and dates."; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("requestedAt", "approvedAt", "generatedAt", "distributedAt", "validUntil", "lastDownloadedAt", "createdAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "uc.id"; }
    public String defaultSort() { return "copyNumber"; }
    public List<String> requiredFields() { return List.of("copyNumber", "documentNumber"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search uncontrolled copies", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "businessUnit", "name", "Business Unit", "type", "LOOKUP"),
                Map.of("code", "requestedFrom", "name", "Requested from", "type", "DATE"),
                Map.of("code", "requestedTo", "name", "Requested to", "type", "DATE"),
                Map.of("code", "distributedFrom", "name", "Distributed from", "type", "DATE"),
                Map.of("code", "distributedTo", "name", "Distributed to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "uc.status_code", "department", "dep.id", "businessUnit", "bu.id"); }
    public Map<String, String> filterColumns() {
        return Map.of("status", "status", "department", "department", "businessUnit", "businessUnit", "requestedFrom", "requestedAt", "requestedTo", "requestedAt",
                "distributedFrom", "distributedAt", "distributedTo", "distributedAt");
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        String grants = ReportQueryKit.grants(actor, scopes, "bu.name", "dep.name",
                "(uc.requested_by_user_id=? or uc.recipient_user_id=? or uc.distributed_by_user_id=?)", () -> List.of(actor.getId(), actor.getId(), actor.getId()), args);
        StringBuilder sql = new StringBuilder("""
                from uncontrolled_copies uc join documents d on d.id=uc.document_id
                left join departments dep on dep.id=d.department_id left join business_units bu on bu.id=d.business_unit_id
                left join document_types dt on dt.id=d.document_type_id
                left join app_users rq on rq.id=uc.requested_by_user_id left join app_users ap on ap.id=uc.approved_by_user_id
                left join app_users ru on ru.id=uc.recipient_user_id where (
                """).append(grants).append(")");
        // REPORT-DC-VISIBILITY-2026-11-12: only what the Document Control list shows the same person.
        ReportQueryKit.and(sql, args, visibility.uncontrolledCopies(actor, "uc"));
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (uc.uncontrolled_copy_number ilike ? escape '\\' or uc.document_number ilike ? escape '\\' or uc.document_title ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            args.add(term); args.add(term); args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "uc.status_code"); equals.put("department", "dep.id"); equals.put("businessUnit", "bu.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "requested", "uc.requested_at::date");
        ReportQueryKit.dates(sql, args, filters, "distributed", "uc.distributed_at::date");
        return new Query(sql.toString(), args);
    }
}
