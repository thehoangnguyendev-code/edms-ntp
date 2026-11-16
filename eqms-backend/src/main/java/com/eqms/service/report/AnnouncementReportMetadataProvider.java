package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "System Announcements" (REPORT-FIELD-CATALOG-2026-11-15): the announcements shown to everyone: the title, the severity, whether it is on, the period it shows and who wrote it.
 * Not divided by department, so the template is given to the whole system scope only; a person needs settings.announcement.view. Never a column: the message.
 */
@Component
public class AnnouncementReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("title", "Title", "a.title");
        column("severity", "Severity", "initcap(lower(a.severity))");
        column("status", "Status", "case when not a.enabled then 'Off' when a.starts_at > now() then 'Scheduled' when a.ends_at is not null and a.ends_at < now() then 'Ended' else 'Showing' end");
        column("startsAt", "Starts At", ReportQueryKit.timestamp("a.starts_at"));
        column("endsAt", "Ends At", ReportQueryKit.timestamp("a.ends_at"));
        group("Record", "enabled", "Enabled", ReportQueryKit.yesNo("a.enabled"));
        group("Record", "version", "Version", "a.version");
        group("Record", "createdBy", "Created By", "a.created_by");
        group("Record", "updatedBy", "Updated By", "a.updated_by");
        group("Record", "createdAt", "Created At", ReportQueryKit.timestamp("a.created_at"));
        group("Record", "updatedAt", "Last Updated", ReportQueryKit.timestamp("a.updated_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "severity", "startsFrom", "startsTo");

    public String code() { return "SYSTEM_ANNOUNCEMENTS"; }
    public String name() { return "System Announcements"; }
    public String category() { return "Security"; }
    public String description() { return "Announcements shown to everyone: the title, the severity, whether it is on, the period it shows and who wrote it."; }
    public List<String> usePermissions() { return List.of("settings.announcement.view"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("startsAt", "endsAt", "createdAt", "updatedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "a.id"; }
    public String defaultSort() { return "startsAt"; }
    public List<String> requiredFields() { return List.of("title", "severity"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search announcements", "type", "TEXT"),
                Map.of("code", "severity", "name", "Severity", "type", "LOOKUP"),
                Map.of("code", "startsFrom", "name", "Starts from", "type", "DATE"),
                Map.of("code", "startsTo", "name", "Starts to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("severity", "a.severity"); }
    public Map<String, String> filterColumns() { return Map.of("severity", "severity", "startsFrom", "startsAt", "startsTo", "startsAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from system_announcements a where true");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and a.title ilike ? escape '\\'");
            args.add(ReportQueryKit.likeTerm(search));
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("severity", "a.severity");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "starts", "a.starts_at::date");
        return new Query(sql.toString(), args);
    }
}
