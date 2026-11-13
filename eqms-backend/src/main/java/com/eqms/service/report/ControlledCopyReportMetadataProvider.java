package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Controlled Copies" (REPORT-DOCUMENT-SOURCES-2026-11-12): the controlled copies with their number, document, purpose, status, people and dates.
 * Metadata only. Never a column: the access token, the preview password, the signature of the recipient, the files and their checksums, the free-text reasons.
 * The department and business unit are those of the document. The data scopes of the template decide which copies a person sees.
 */
@Component
public class ControlledCopyReportMetadataProvider implements ReportMetadataProvider {
    private final DocumentReportVisibility visibility;

    public ControlledCopyReportMetadataProvider(DocumentReportVisibility visibility) { this.visibility = visibility; }

    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("copyNumber", "Controlled Copy Number", "cc.controlled_copy_number");
        column("documentNumber", "Document Number", "cc.document_number");
        column("documentTitle", "Document Name", "cc.document_title");
        column("revisionNumber", "Revision", "cc.revision_number");
        column("purpose", "Purpose", "case cc.usage_purpose when 'READ_AND_COMPLY' then 'Read and Comply' when 'RECORD_KEEPING' then 'Record-keeping' else '' end");
        column("status", "Status", "coalesce(cs.label, cc.status_code)");
        column("distributionMode", "Distribution", "case cc.distribution_mode when 'INTERNAL' then 'Internal' when 'EXTERNAL' then 'External' else '' end");
        column("documentType", "Document Type", "dt.name");
        column("department", "Department", "dep.name");
        column("businessUnit", "Business Unit", "bu.name");
        column("requestedBy", "Requested By", "rq.full_name");
        column("requestedAt", "Requested At", ReportQueryKit.timestamp("cc.requested_at"));
        column("distributedAt", "Distributed At", ReportQueryKit.timestamp("cc.distributed_at"));
        column("recipient", "Recipient", "coalesce(ru.full_name, cc.recipient_name)");
        column("location", "Location", "cc.location");
        column("validUntil", "Valid Until", "cc.valid_until");
        column("expiryDate", "Expiry", ReportQueryKit.timestamp("cc.expiry_date"));
        column("recalledAt", "Recalled At", ReportQueryKit.timestamp("cc.recalled_at"));
        column("downloadCount", "Downloads", "cc.download_count");
        column("printCount", "Prints", "cc.print_count");
        column("lastDownloadedAt", "Last Downloaded", ReportQueryKit.timestamp("cc.last_downloaded_at"));
        column("createdAt", "Created", ReportQueryKit.timestamp("cc.created_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "status", "purpose", "department", "businessUnit", "requestedFrom", "requestedTo",
            "distributedFrom", "distributedTo", "expiryFrom", "expiryTo");

    public String code() { return "CONTROLLED_COPIES"; }
    public String name() { return "Controlled Copies"; }
    public String description() { return "Controlled copies with their document, purpose, status, recipient, expiry and recall dates."; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("requestedAt", "distributedAt", "validUntil", "expiryDate", "recalledAt", "lastDownloadedAt", "createdAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "cc.id"; }
    public String defaultSort() { return "copyNumber"; }
    public List<String> requiredFields() { return List.of("copyNumber", "documentNumber"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search controlled copies", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "purpose", "name", "Purpose", "type", "LOOKUP"),
                Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
                Map.of("code", "businessUnit", "name", "Business Unit", "type", "LOOKUP"),
                Map.of("code", "requestedFrom", "name", "Requested from", "type", "DATE"),
                Map.of("code", "requestedTo", "name", "Requested to", "type", "DATE"),
                Map.of("code", "distributedFrom", "name", "Distributed from", "type", "DATE"),
                Map.of("code", "distributedTo", "name", "Distributed to", "type", "DATE"),
                Map.of("code", "expiryFrom", "name", "Expiry from", "type", "DATE"),
                Map.of("code", "expiryTo", "name", "Expiry to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "cc.status_code", "purpose", "cc.usage_purpose", "department", "dep.id", "businessUnit", "bu.id"); }
    public Map<String, String> filterColumns() {
        return Map.ofEntries(Map.entry("status", "status"), Map.entry("purpose", "purpose"), Map.entry("department", "department"), Map.entry("businessUnit", "businessUnit"),
                Map.entry("requestedFrom", "requestedAt"), Map.entry("requestedTo", "requestedAt"), Map.entry("distributedFrom", "distributedAt"),
                Map.entry("distributedTo", "distributedAt"), Map.entry("expiryFrom", "expiryDate"), Map.entry("expiryTo", "expiryDate"));
    }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        String grants = ReportQueryKit.grants(actor, scopes, "bu.name", "dep.name",
                "(cc.requested_by_user_id=? or cc.recipient_user_id=? or cc.distributed_by_user_id=?)", () -> List.of(actor.getId(), actor.getId(), actor.getId()), args);
        StringBuilder sql = new StringBuilder("""
                from controlled_copies cc join documents d on d.id=cc.document_id left join controlled_copy_statuses cs on cs.code=cc.status_code
                left join departments dep on dep.id=d.department_id left join business_units bu on bu.id=d.business_unit_id
                left join document_types dt on dt.id=d.document_type_id
                left join app_users rq on rq.id=cc.requested_by_user_id left join app_users ru on ru.id=cc.recipient_user_id where (
                """).append(grants).append(")");
        // REPORT-DC-VISIBILITY-2026-11-12: only what the Document Control list shows the same person.
        ReportQueryKit.and(sql, args, visibility.controlledCopies(actor, "cc"));
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (cc.controlled_copy_number ilike ? escape '\\' or cc.document_number ilike ? escape '\\' or cc.document_title ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            args.add(term); args.add(term); args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "cc.status_code"); equals.put("purpose", "cc.usage_purpose"); equals.put("department", "dep.id"); equals.put("businessUnit", "bu.id");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "requested", "cc.requested_at::date");
        ReportQueryKit.dates(sql, args, filters, "distributed", "cc.distributed_at::date");
        ReportQueryKit.dates(sql, args, filters, "expiry", "cc.expiry_date::date");
        return new Query(sql.toString(), args);
    }
}
