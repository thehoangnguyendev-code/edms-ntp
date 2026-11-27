package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Report Runs" (REPORT-FIELD-CATALOG-2026-11-15): the history of the report runs, with the template, the format, the state, the times and who asked. Under the personal scope a person
 * sees the runs they asked for; under the whole-system scope, all of them. Never a column: the parameters and the filters of a run, the authorization snapshot, the error text and the files.
 */
@Component
public class ReportRunReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("reportTitle", "Generated Report Name", "coalesce(r.report_title, r.definition_code)");
        column("templateCode", "Report Template Number", "r.definition_code");
        column("templateName", "Report Template Name", "d.display_name");
        column("status", "Run Status", "initcap(replace(lower(r.status), '_', ' '))");
        column("format", "Output Format", "r.requested_format");
        column("requestedBy", "Requested By", ReportQueryKit.person("r.requester_user_id"));
        column("queuedAt", "Queued At", ReportQueryKit.timestamp("r.queued_at"));
        column("completedAt", "Completed At", ReportQueryKit.timestamp("r.completed_at"));
        group("Run", "startedAt", "Started At", ReportQueryKit.timestamp("r.started_at"));
        group("Run", "requestType", "Request Type", "initcap(replace(lower(r.request_type), '_', ' '))");
        group("Run", "scheduled", "Scheduled", ReportQueryKit.yesNo("r.schedule_id is not null"));
        group("Run", "fullRun", "Full Run (No Filter)", ReportQueryKit.yesNo("coalesce(r.full_run, false)"));
        group("Run", "attempts", "Attempts", "r.attempt_count");
        group("Run", "reasonCode", "Failure Reason Code", "r.reason_code");
        group("Run", "templateVersion", "Report Template Revision", "r.definition_version");
        group("Run", "durationSeconds", "Duration (s)", "case when r.started_at is null or r.completed_at is null then null else round(extract(epoch from (r.completed_at - r.started_at))::numeric, 1) end");
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "status", "templateCode", "queuedFrom", "queuedTo");

    public String code() { return "REPORT_RUNS"; }
    public String name() { return "Report Runs"; }
    public String category() { return "Reports"; }
    public String description() { return "The history of report runs: the template, the format, the state, the times and who asked for the run."; }
    public List<String> usePermissions() { return List.of("reports.run.view_own", "report.module.view"); }
    public List<String> allowedScopes() { return List.of("PERSONAL", "SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("queuedAt", "completedAt", "startedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "r.id"; }
    public String defaultSort() { return "queuedAt"; }
    public List<String> requiredFields() { return List.of("reportTitle", "status"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search report runs", "type", "TEXT"),
                Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
                Map.of("code", "templateCode", "name", "Report Template", "type", "LOOKUP"),
                Map.of("code", "queuedFrom", "name", "Queued from", "type", "DATE"),
                Map.of("code", "queuedTo", "name", "Queued to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("status", "r.status", "templateCode", "r.definition_code"); }
    public Map<String, String> filterColumns() { return Map.of("status", "status", "templateCode", "templateCode", "queuedFrom", "queuedAt", "queuedTo", "queuedAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        List<Object> args = new ArrayList<>();
        String grants = ReportQueryKit.grantsOf(actor, scopes, ReportQueryKit.EVERYTHING, new ReportQueryKit.Cond("false", List.of()),
                new ReportQueryKit.Cond("r.requester_user_id=?", List.of(actor.getId())), args);
        StringBuilder sql = new StringBuilder("from report_runs r left join report_definitions d on d.code=r.definition_code where (").append(grants).append(")");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(r.definition_code) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(r.report_title,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(d.display_name,'')) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 3; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("status", "r.status"); equals.put("templateCode", "r.definition_code");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "queued", "r.queued_at::date");
        return new Query(sql.toString(), args);
    }
}
