package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Backup and Restore Runs" (REPORT-BACKUP-RUNS-2026-11-15): one line for each backup, verification, restore, restore rehearsal and store scrub: what it was, how it ended, when, who,
 * how big, and for a rehearsal how long the restore took. It reads backup_run_summary, the copy that the application keeps of the summary in the backup control database (see
 * BackupRunSummarySyncService), so a report is as current as the last copy: the column "Copied At" says when. Only the whole system scope is given, and a person needs backup.module.view and
 * audit.export. Never a column: error text, paths, keys, manifests or the detail of a run.
 */
@Component
public class BackupRunReportMetadataProvider implements ReportMetadataProvider {
    private static final String KIND = "case s.kind when 'BACKUP' then 'Backup' when 'VERIFICATION' then 'Verification' when 'RESTORE' then 'Restore' when 'REHEARSAL' then 'Restore Rehearsal' "
            + "when 'SCRUB' then 'Store Scrub' else s.kind end";
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("reference", "Reference", "s.reference");
        column("kind", "Kind", KIND);
        column("status", "Result", "initcap(replace(lower(s.status), '_', ' '))");
        column("startedAt", "Started At", ReportQueryKit.timestamp("s.started_at"));
        column("finishedAt", "Finished At", ReportQueryKit.timestamp("s.finished_at"));
        column("actor", "Performed By", "s.actor");
        group("Run", "backupNumber", "Backup Number", "s.backup_number");
        group("Run", "trigger", "Triggered", "initcap(replace(lower(s.trigger_kind), '_', ' '))");
        group("Run", "runType", "Backup Type", "initcap(replace(lower(s.run_type), '_', ' '))");
        group("Run", "environment", "Environment", "s.environment");
        group("Run", "tier", "Storage Tier", "s.tier");
        group("Run", "reason", "Reason", "s.reason");
        group("Run", "changeControl", "Change Control", "s.change_control_ref");
        group("Size and time", "sizeGb", "Size (GB)", "case when s.size_bytes is null then null else round(s.size_bytes / 1073741824.0, 3) end");
        group("Size and time", "durationSeconds", "Duration (s)", "case when s.started_at is null or s.finished_at is null then null else round(extract(epoch from (s.finished_at - s.started_at))::numeric, 1) end");
        group("Size and time", "restoreSeconds", "Restore Time (s)", "s.restore_seconds");
        group("Failure", "errorCode", "Error Code", "s.error_code");
        group("Failure", "failedStep", "Failed Step", "s.failed_step");
        group("Scrub", "checkedFiles", "Files Checked", "s.checked_files");
        group("Scrub", "differentFiles", "Files That Differ", "s.different_files");
        group("Scrub", "missingFiles", "Files Missing", "s.missing_files");
        group("Copy", "copiedAt", "Copied At", ReportQueryKit.timestamp("s.synced_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "kind", "status", "startedFrom", "startedTo");

    public String code() { return "BACKUP_RUNS"; }
    public String name() { return "Backup and Restore Runs"; }
    public String category() { return "Backup and Restore"; }
    public String description() { return "Every backup, verification, restore, restore rehearsal and store scrub: how it ended, when, who, how big and how long. A copy of the summary kept by the backup system."; }
    public List<String> requiredPermissions() { return List.of("backup.module.view", "audit.export"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("startedAt", "finishedAt", "copiedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "s.source_id"; }
    public String defaultSort() { return "startedAt"; }
    public List<String> requiredFields() { return List.of("reference", "status"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search backup and restore runs", "type", "TEXT"),
                Map.of("code", "kind", "name", "Kind", "type", "LOOKUP"),
                Map.of("code", "status", "name", "Result", "type", "LOOKUP"),
                Map.of("code", "startedFrom", "name", "Started from", "type", "DATE"),
                Map.of("code", "startedTo", "name", "Started to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("kind", "s.kind", "status", "s.status"); }
    public Map<String, String> filterColumns() { return Map.of("kind", "kind", "status", "status", "startedFrom", "startedAt", "startedTo", "startedAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from backup_run_summary s where true");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(coalesce(s.reference,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(s.backup_number,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(s.actor,'')) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 3; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("kind", "s.kind"); equals.put("status", "s.status");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "started", "s.started_at::date");
        return new Query(sql.toString(), args);
    }
}
