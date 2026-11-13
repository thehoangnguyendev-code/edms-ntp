package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Electronic Signatures" (REPORT-SECURITY-SOURCES-2026-11-12): the signature manifestation of every electronic signature: who signed, what the signature means, when, on
 * which record. A report of it is a file of audit records: a person needs audit.view and audit.export, the template is given to the whole system scope only, and a run names a date range
 * of at most {@link AuditTrailReportMetadataProvider#MAX_DAYS} days. Never a column: the address and device, the verification id, the checksums and the free-text reason and comment.
 */
@Component
public class ElectronicSignatureReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("signedAt", "Signed At", ReportQueryKit.timestamp("es.signed_at"));
        column("signatureNumber", "Signature Number", "es.signature_id");
        column("signer", "Signer", "es.full_name");
        column("username", "Username", "es.username");
        column("department", "Department", "es.department");
        column("position", "Position", "es.position");
        column("meaning", "Meaning", "coalesce(m.display_name, es.meaning)");
        column("recordType", "Record Type", "initcap(replace(regexp_replace(es.entity_type, '([a-z])([A-Z])', '\\1 \\2', 'g'), '_', ' '))");
        column("documentNumber", "Document Number", "d.document_number");
        column("revisionNumber", "Revision", "r.revision_number");
        column("method", "Authentication", "initcap(replace(es.authentication_method, '_', ' '))");
        column("status", "Status", "initcap(replace(es.status, '_', ' '))");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "meaning", "signedFrom", "signedTo");

    public String code() { return "ELECTRONIC_SIGNATURES"; }
    public String name() { return "Electronic Signatures"; }
    public String category() { return "Audit"; }
    public String description() { return "Electronic signatures: the signer, the meaning, the date and time, and the record that was signed."; }
    public List<String> requiredPermissions() { return List.of("audit.view", "audit.export"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    @Override public boolean runNeedsSignature() { return true; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("signedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "es.id"; }
    public String defaultSort() { return "signedAt"; }
    public List<String> requiredFields() { return List.of("signedAt", "signer", "meaning"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search electronic signatures", "type", "TEXT"),
                Map.of("code", "meaning", "name", "Meaning", "type", "LOOKUP"),
                Map.of("code", "signedFrom", "name", "From date (required)", "type", "DATE"),
                Map.of("code", "signedTo", "name", "To date (required)", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("meaning", "es.meaning"); }
    public Map<String, String> filterColumns() { return Map.of("meaning", "meaning", "signedFrom", "signedAt", "signedTo", "signedAt"); }

    @Override
    public void validateRun(Map<String, Object> filters) { ReportQueryKit.requireRange(filters, "signed", AuditTrailReportMetadataProvider.MAX_DAYS); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                from electronic_signatures es left join electronic_signature_meanings m on m.code=es.meaning
                left join documents d on d.id=es.document_id left join document_revisions r on r.id=es.revision_id where true""");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (coalesce(es.full_name,'') ilike ? escape '\\' or coalesce(es.username,'') ilike ? escape '\\' or coalesce(es.signature_id,'') ilike ? escape '\\'"
                    + " or coalesce(d.document_number,'') ilike ? escape '\\' or coalesce(es.meaning,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 5; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("meaning", "es.meaning");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.momentRange(sql, args, filters, "signed", "es.signed_at");
        return new Query(sql.toString(), args);
    }
}
