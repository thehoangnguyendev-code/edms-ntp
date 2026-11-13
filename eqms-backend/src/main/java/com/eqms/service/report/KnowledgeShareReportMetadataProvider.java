package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Knowledge Share Links" (REPORT-SECURITY-SOURCES-2026-11-12): the links through which Knowledge Base documents are shared outside the normal access: what each link
 * covers, who made it, when it expires and whether it was revoked. A person needs security.access_review.view (the Access Review screen hosts the same list) and the template is given
 * to the whole system scope only. Never a column: the token or its hash.
 */
@Component
public class KnowledgeShareReportMetadataProvider implements ReportMetadataProvider {
    private static final String STATE = "case when l.revoked_at is not null then 'Revoked' when l.expires_at is not null and l.expires_at < now() then 'Expired' else 'Active' end";
    private static final String STATE_CODE = "case when l.revoked_at is not null then 'REVOKED' when l.expires_at is not null and l.expires_at < now() then 'EXPIRED' else 'ACTIVE' end";
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    static {
        column("label", "Link", "l.label");
        column("state", "State", STATE);
        column("scope", "Shares", "initcap(replace(lower(l.scope_kind), '_', ' '))");
        column("businessUnit", "Business Unit", "bu.name");
        column("department", "Department", "dep.name");
        column("documentType", "Document Type", "dt.name");
        column("documentNumber", "Document Number", "d.document_number");
        column("createdBy", "Created By", "cb.full_name");
        column("createdAt", "Created At", ReportQueryKit.timestamp("l.created_at"));
        column("expiresAt", "Expires At", ReportQueryKit.timestamp("l.expires_at"));
        column("revokedAt", "Revoked At", ReportQueryKit.timestamp("l.revoked_at"));
        column("revokedBy", "Revoked By", "rb.full_name");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }

    private static final Set<String> FILTERS = Set.of("search", "state", "createdFrom", "createdTo", "expiresFrom", "expiresTo");

    public String code() { return "KNOWLEDGE_SHARE_LINKS"; }
    public String name() { return "Knowledge Share Links"; }
    public String category() { return "Security"; }
    public String description() { return "Links that share Knowledge Base documents: what each covers, who made it, when it expires, and whether it was revoked."; }
    public List<String> usePermissions() { return List.of("security.access_review.view"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("createdAt", "expiresAt", "revokedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "l.id"; }
    public String defaultSort() { return "createdAt"; }
    public List<String> requiredFields() { return List.of("label", "state"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search share links", "type", "TEXT"),
                Map.of("code", "state", "name", "State", "type", "LOOKUP"),
                Map.of("code", "createdFrom", "name", "Created from", "type", "DATE"),
                Map.of("code", "createdTo", "name", "Created to", "type", "DATE"),
                Map.of("code", "expiresFrom", "name", "Expires from", "type", "DATE"),
                Map.of("code", "expiresTo", "name", "Expires to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("state", STATE_CODE); }
    public Map<String, String> filterColumns() { return Map.of("state", "state", "createdFrom", "createdAt", "createdTo", "createdAt", "expiresFrom", "expiresAt", "expiresTo", "expiresAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                from knowledge_share_links l left join business_units bu on bu.id=l.owner_business_unit_id left join departments dep on dep.id=l.owner_department_id
                left join document_types dt on dt.id=l.document_type_id left join documents d on d.id=l.document_id
                left join app_users cb on cb.id=l.created_by left join app_users rb on rb.id=l.revoked_by where true""");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (coalesce(l.label,'') ilike ? escape '\\' or coalesce(d.document_number,'') ilike ? escape '\\' or coalesce(cb.full_name,'') ilike ? escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 3; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("state", STATE_CODE);
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "created", "l.created_at::date");
        ReportQueryKit.dates(sql, args, filters, "expires", "l.expires_at::date");
        return new Query(sql.toString(), args);
    }
}
