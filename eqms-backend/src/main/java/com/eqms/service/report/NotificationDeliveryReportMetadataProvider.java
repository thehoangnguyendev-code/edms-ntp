package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Notification Delivery" (REPORT-FIELD-CATALOG-2026-11-15): the e-mails the system sent or tried to send: the event, its module, the state, the times and the recipient address.
 * It lists the addresses of people, so like the Audit Trail type a person needs audit.view and audit.export, the template is given to the whole system scope only, a run names a date range of
 * at most {@link AuditTrailReportMetadataProvider#MAX_DAYS} days and is signed. The address is a Sensitive field. Never a column: the subject, the body and the payload of an e-mail.
 */
@Component
public class NotificationDeliveryReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("createdAt", "Created At", ReportQueryKit.timestamp("o.created_at"));
        column("event", "Event", "o.event_code");
        column("domain", "Module", com.eqms.util.ModuleKeys.menuNameSql("o.event_domain"));
        column("status", "Status", "initcap(replace(lower(o.status), '_', ' '))");
        column("completedAt", "Completed At", ReportQueryKit.timestamp("o.completed_at"));
        group("Delivery", "priority", "Priority", "o.priority");
        group("Delivery", "errorCode", "Error Code", "o.error_code");
        group("Recipient", "recipientEmail", "Recipient Email", "o.recipient_email");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }
    @Override public Set<String> sensitiveFields() { return Set.of("recipientEmail"); }

    private static final Set<String> FILTERS = Set.of("search", "status", "domain", "createdFrom", "createdTo");

    public String code() { return "NOTIFICATION_DELIVERY"; }
    public String name() { return "Notification Delivery"; }
    public String category() { return "Audit"; }
    public String description() { return "E-mails the system sent or tried to send: the event, the module, the state, the times and the recipient address."; }
    public List<String> requiredPermissions() { return List.of("audit.view", "audit.export"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    @Override public boolean runNeedsSignature() { return true; }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("createdAt", "completedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "o.id"; }
    public String defaultSort() { return "createdAt"; }
    public List<String> requiredFields() { return List.of("createdAt", "event"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search notification delivery", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "domain", "name", "Module", "type", "LOOKUP"),
                Map.of("code", "createdFrom", "name", "From date (required)", "type", "DATE"),
                Map.of("code", "createdTo", "name", "To date (required)", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "o.status", "domain", com.eqms.util.ModuleKeys.menuNameSql("o.event_domain")); }
    public Map<String, String> filterColumns() { return Map.of("status", "status", "domain", "domain", "createdFrom", "createdAt", "createdTo", "createdAt"); }

    @Override
    public void validateRun(Map<String, Object> filters) { validateRun(filters, AuditTrailReportMetadataProvider.MAX_DAYS); }

    @Override
    public void validateRun(Map<String, Object> filters, int maxRangeDays) { ReportQueryKit.requireRange(filters, "created", maxRangeDays); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from notification_email_outbox o where true");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(coalesce(o.event_code,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(o.event_domain,'')) like eqms_fold(?) escape '\\' or eqms_fold(o.recipient_email) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 3; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "o.status"); equals.put("domain", com.eqms.util.ModuleKeys.menuNameSql("o.event_domain"));
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.momentRange(sql, args, filters, "created", "o.created_at");
        return new Query(sql.toString(), args);
    }
}
