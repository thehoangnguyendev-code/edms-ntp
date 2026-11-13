package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.ReportPlatformService;
import com.eqms.service.training.TrainingAccess;
import com.eqms.service.training.TrainingComplianceService;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reports Overview and Quality Analytics (REPORT-OVERVIEW-2026-11-12, plan phase R6). Everything here is read from the records of the system at the moment of the request: no number is
 * kept, estimated or filled in. A figure that cannot be read is an error for the screen to show as such, never a zero. The screens need report.module.view; each Quality Analytics section
 * needs the permission of the module it counts, and counts what that module lets the person see (Training: the own department unless training.scope.all).
 */
@Service
public class ReportOverviewService {
    /** The most reports a person may pin. */
    public static final int MAX_PINS = 20;
    /** Revision statuses that are still work in progress, in the order of the workflow. */
    private static final String IN_PROGRESS_SQL = "('DRAFT','PENDING_REVIEW','PENDING_APPROVAL','PENDING_TRAINING','READY_FOR_PUBLISHING')";
    /** Days since a revision entered its present status; the same rule as the Document Revisions report type. */
    private static final String DAYS_IN_STATUS = "greatest(0, current_date - coalesce((select max(h.created_at) from revision_workflow_history h where h.revision_id=r.id "
            + "and h.to_status=r.status_code and h.from_status is distinct from h.to_status), r.created_at)::date)";
    private static final Map<String, String> TRAINING_STATUS = new LinkedHashMap<>();
    static {
        TRAINING_STATUS.put("RESERVED", "Pending Document Approval");
        TRAINING_STATUS.put("PLANNED", "Planned");
        TRAINING_STATUS.put("NOTIFIED", "Notified");
        TRAINING_STATUS.put("IN_PROGRESS", "In Progress");
        TRAINING_STATUS.put("PENDING_QA_CONFIRMATION", "Pending QA Confirmation");
        TRAINING_STATUS.put("COMPLETED", "Completed");
        TRAINING_STATUS.put("CANCELLED", "Closed - Cancelled");
    }

    private final JdbcTemplate jdbc;
    private final EffectivePermissionService permissions;
    private final ReportPlatformService reports;
    private final TrainingAccess trainingAccess;
    private final DocumentReportVisibility visibility;

    public ReportOverviewService(JdbcTemplate jdbc, EffectivePermissionService permissions, ReportPlatformService reports, TrainingAccess trainingAccess, DocumentReportVisibility visibility) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.reports = reports;
        this.trainingAccess = trainingAccess;
        this.visibility = visibility;
    }

    private Set<String> require(UserAccount actor, String... anyOf) {
        Set<String> codes = actor == null ? Set.of() : permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(anyOf).noneMatch(codes::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
        return codes;
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    // ---- Reports Overview -------------------------------------------------------------------------------------------------------------------

    /**
     * What needs the attention of the person: failed runs of the last 30 days, runs still being made, runs finished in the last 7 days, suspended schedules and, for a person who approves
     * templates, the templates waiting for approval. A person sees their own runs and schedules, and everyone's with reports.run.view_all and reports.schedule.manage.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> overview(UserAccount actor) {
        Set<String> codes = require(actor, "report.module.view");
        boolean allRuns = codes.contains("reports.run.view_all");
        boolean allSchedules = codes.contains("reports.schedule.manage");
        String runScope = allRuns ? "" : " and requester_user_id=?";
        Object[] runArgs = allRuns ? new Object[0] : new Object[] {actor.getId()};
        List<Map<String, Object>> items = new ArrayList<>();
        long failed = count("select count(*) from report_runs where status='FAILED' and queued_at > now() - interval '30 days'" + runScope, runArgs);
        add(items, "FAILED_RUNS", "red", failed, failed == 1 ? "1 run failed" : failed + " runs failed",
                "In the last 30 days. Open the run to see the reason, then retry it or start a new request.", "/report/history?status=FAILED");
        long suspended = count("select count(*) from report_schedules where status like 'SUSPENDED%'" + (allSchedules ? "" : " and creator_user_id=?"),
                allSchedules ? new Object[0] : new Object[] {actor.getId()});
        add(items, "SUSPENDED_SCHEDULES", "amber", suspended, suspended == 1 ? "1 schedule suspended" : suspended + " schedules suspended",
                "A schedule is suspended when the access of its owner changed or its template was disabled or changed. Open it to resume or correct it.", "/report/scheduled");
        long running = count("select count(*) from report_runs where status in ('QUEUED','PROCESSING','RETRY_SCHEDULED')" + runScope, runArgs);
        add(items, "RUNNING_RUNS", "blue", running, running == 1 ? "1 run in progress" : running + " runs in progress", "Being made now.", "/report/history");
        if (codes.contains("reports.definition.approve") || codes.contains("reports.definition.approve_gmp")) {
            long waiting = count("select count(*) from report_definitions where approval_status='PENDING_APPROVAL' and deleted_at is null and source_code is not null");
            add(items, "TEMPLATES_TO_APPROVE", "blue", waiting, waiting == 1 ? "1 template waiting for approval" : waiting + " templates waiting for approval",
                    "A template is approved by a person other than its author before it can run.", "/report/templates");
        }
        long ready = count("select count(*) from report_runs where status='COMPLETED' and completed_at > now() - interval '7 days'" + runScope, runArgs);
        add(items, "READY_RUNS", "emerald", ready, ready == 1 ? "1 run finished" : ready + " runs finished", "In the last 7 days. The files are ready to download.", "/report/history?status=COMPLETED");
        return Map.of("attention", items, "generatedAt", java.time.Instant.now().toString());
    }

    private static void add(List<Map<String, Object>> items, String code, String tone, long count, String title, String detail, String path) {
        if (count <= 0) return;
        items.add(Map.of("code", code, "tone", tone, "count", count, "title", title, "detail", detail, "path", path));
    }

    // ---- Pinned reports ---------------------------------------------------------------------------------------------------------------------

    /** The reports the person pinned, newest first, and only those the person may still run: a pin grants nothing. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> pins(UserAccount actor) {
        require(actor, "report.module.view");
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select p.definition_code as code, d.display_name as name, d.active as active, d.source_code as "sourceCode", p.pinned_at as "pinnedAt"
                  from report_pins p join report_definitions d on d.code=p.definition_code
                 where p.user_id=? and d.deleted_at is null order by p.pinned_at desc""", actor.getId());
        Set<String> runnable = runnableCodes(actor);
        return rows.stream().filter(row -> runnable.contains(String.valueOf(row.get("code")))).toList();
    }

    @Transactional
    public void pin(UserAccount actor, String code) {
        require(actor, "report.module.view");
        if (code == null || code.isBlank() || code.length() > 100 || !runnableCodes(actor).contains(code)) throw new IllegalArgumentException("REPORT_TEMPLATE_NOT_FOUND");
        if (count("select count(*) from report_pins where user_id=? and definition_code<>?", actor.getId(), code) >= MAX_PINS) throw new IllegalArgumentException("REPORT_PIN_LIMIT");
        jdbc.update("insert into report_pins(user_id, definition_code) values(?,?) on conflict do nothing", actor.getId(), code);
    }

    @Transactional
    public void unpin(UserAccount actor, String code) {
        require(actor, "report.module.view");
        jdbc.update("delete from report_pins where user_id=? and definition_code=?", actor.getId(), code);
    }

    private Set<String> runnableCodes(UserAccount actor) {
        Set<String> codes = new HashSet<>();
        for (Map<String, Object> template : reports.catalog(actor)) codes.add(String.valueOf(template.get("code")));
        return codes;
    }

    // ---- Quality Analytics: Document Control --------------------------------------------------------------------------------------------------

    /**
     * Document Control figures: what is effective, what is in progress and how long it waits, what is due for review, which copies are out. Needs documents.module.view.
     * REPORT-DC-VISIBILITY-2026-11-12: every figure counts only what the Document Control lists show the same person (all of it for a view-everything holder).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> documentControl(UserAccount actor) {
        require(actor, "report.module.view");
        require(actor, "documents.module.view");
        var visibleDocuments = visibility.documents(actor, "d");
        var visibleRevisions = visibility.revisions(actor, "r");
        var visibleCopies = visibility.controlledCopies(actor, "cc");
        Map<String, Object> docs = jdbc.queryForMap("""
                select count(*) filter (where d.status_code='ACTIVE') as effective,
                       count(*) filter (where d.status_code='ACTIVE' and d.effective_date >= current_date - 90) as revised90,
                       count(*) filter (where d.status_code='ACTIVE' and d.review_date is not null and d.review_date <= current_date + 30) as review_due,
                       count(*) filter (where d.status_code='ACTIVE' and d.review_date is not null and d.review_date < current_date) as review_overdue
                  from documents d where\s""" + visibleDocuments.sql(), visibleDocuments.args().toArray());
        List<Map<String, Object>> stages = jdbc.queryForList("select r.status_code as code, coalesce(rs.label, r.status_code) as label, count(*) as value, "
                + "count(*) filter (where r.status_code <> 'DRAFT' and " + DAYS_IN_STATUS + " > 14) as waiting "
                + "from document_revisions r left join revision_statuses rs on rs.code=r.status_code where r.status_code in " + IN_PROGRESS_SQL + " and " + visibleRevisions.sql() + " group by r.status_code, rs.label, rs.sort_order "
                + "order by coalesce(rs.sort_order, 99)", visibleRevisions.args().toArray());
        long inProgress = stages.stream().mapToLong(row -> ((Number) row.get("value")).longValue()).sum();
        long waiting = stages.stream().mapToLong(row -> ((Number) row.get("waiting")).longValue()).sum();
        Map<String, Object> copies = jdbc.queryForMap("select count(*) filter (where cc.status_code='DISTRIBUTED') as out, "
                + "count(*) filter (where cc.status_code='DISTRIBUTED' and cc.expiry_date is not null and cc.expiry_date < now()) as expired from controlled_copies cc where " + visibleCopies.sql(),
                visibleCopies.args().toArray());
        List<Map<String, Object>> byType = jdbc.queryForList("""
                select dt.name as type,
                       (select count(*) from documents d where d.document_type_id=dt.id and d.status_code='ACTIVE' and %s) as effective,
                       (select count(*) from document_revisions r where r.document_type_id=dt.id and r.status_code in %s and %s) as "inRevision",
                       (select count(*) from documents d where d.document_type_id=dt.id and d.status_code='ACTIVE' and d.review_date is not null and d.review_date <= current_date + 30 and %s) as "reviewDue"
                  from document_types dt order by 2 desc, 3 desc, dt.name""".formatted(visibleDocuments.sql(), IN_PROGRESS_SQL, visibleRevisions.sql(), visibleDocuments.sql()),
                // The placeholders of the three sub-selects, in the order they appear.
                concat(visibleDocuments.args(), visibleRevisions.args(), visibleDocuments.args()));
        List<Map<String, Object>> types = byType.stream().filter(row -> ((Number) row.get("effective")).longValue() + ((Number) row.get("inRevision")).longValue() > 0).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("effectiveDocuments", docs.get("effective"));
        result.put("revisedLast90Days", docs.get("revised90"));
        result.put("revisionsInProgress", inProgress);
        result.put("revisionsWaitingOver14Days", waiting);
        result.put("reviewsDue", docs.get("review_due"));
        result.put("reviewsOverdue", docs.get("review_overdue"));
        result.put("controlledCopiesOut", copies.get("out"));
        result.put("controlledCopiesExpired", copies.get("expired"));
        result.put("revisionsByStage", stages.stream().filter(row -> ((Number) row.get("value")).longValue() > 0).map(row -> Map.of("label", row.get("label"), "value", row.get("value"))).toList());
        result.put("byType", types);
        return result;
    }

    @SafeVarargs
    private static Object[] concat(List<Object>... lists) {
        List<Object> all = new java.util.ArrayList<>();
        for (List<Object> list : lists) {
            all.addAll(list);
        }
        return all.toArray();
    }

    // ---- Quality Analytics: Training -----------------------------------------------------------------------------------------------------------

    /**
     * Training figures of the departments the person may see: the Training module's own rule (the own department unless training.scope.all). Needs training.compliance.view or
     * training.activity.view. The compliance figures are computed by the one definition the Compliance screens use.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> training(UserAccount actor) {
        require(actor, "report.module.view");
        require(actor, "training.compliance.view", "training.activity.view");
        boolean all = trainingAccess.allDepartments(actor);
        String own = actor.getDepartment() == null ? "" : actor.getDepartment().trim();
        Map<String, Object> result = new LinkedHashMap<>();
        if (!all && own.isBlank()) {
            result.put("note", "NO_DEPARTMENT");
            return result;
        }
        String visibleActivities = all ? "true" : "lower(trim(dep.name))=lower(trim(?))";
        Object[] visibleArgs = all ? new Object[0] : new Object[] {own};
        String open = "a.status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION')";
        String from = "from training_activities a join departments dep on dep.id=a.organizer_department_id where " + visibleActivities;
        Map<String, Long> byStatus = new HashMap<>();
        jdbc.query("select a.status, count(*) " + from + " group by a.status", rs -> { byStatus.put(rs.getString(1), rs.getLong(2)); }, visibleArgs);
        List<Map<String, Object>> statusSeries = new ArrayList<>();
        TRAINING_STATUS.forEach((code, label) -> {
            long n = byStatus.getOrDefault(code, 0L);
            if (n > 0) statusSeries.add(Map.of("label", label, "value", n));
        });
        result.put("overdueActivities", count("select count(*) " + from + " and " + open + " and a.due_date < current_date", visibleArgs));
        result.put("dueSoonActivities", count("select count(*) " + from + " and " + open + " and a.due_date between current_date and current_date + 14", visibleArgs));
        result.put("openActivities", count("select count(*) " + from + " and " + open, visibleArgs));
        result.put("absentInOpenActivities", count("select count(*) from training_participants p join training_activities a on a.id=p.activity_id join departments dep on dep.id=a.organizer_department_id "
                + "where " + visibleActivities + " and " + open + " and p.state='ABSENT'", visibleArgs));
        result.put("activitiesByStatus", statusSeries);
        Map<String, Object> coverage = jdbc.queryForMap("select count(*) as required, count(*) filter (where x.status='OK') as ok, count(*) filter (where x.status='MISSING') as missing, "
                + "count(*) filter (where x.status='DUE') as due from departments dep cross join lateral (" + TrainingComplianceService.coverageSql("dep.id") + ") x where "
                + visibleActivities, visibleArgs);
        long required = ((Number) coverage.get("required")).longValue();
        long ok = ((Number) coverage.get("ok")).longValue();
        result.put("requirements", required);
        result.put("trained", ok);
        result.put("notTrained", coverage.get("missing"));
        result.put("annualDue", coverage.get("due"));
        result.put("percentTrained", required == 0 ? null : Math.round(ok * 1000.0 / required) / 10.0);
        return result;
    }

    // ---- Quality Analytics: use of the reports -------------------------------------------------------------------------------------------------

    /** How many runs were requested each week of the last six, and how they ended. A person sees their own runs, and everyone's with reports.run.view_all. */
    @Transactional(readOnly = true)
    public Map<String, Object> usage(UserAccount actor) {
        Set<String> codes = require(actor, "report.module.view");
        boolean all = codes.contains("reports.run.view_all");
        String scope = all ? "" : " and requester_user_id=?";
        Object[] args = all ? new Object[0] : new Object[] {actor.getId()};
        List<Map<String, Object>> weeks = jdbc.queryForList("select date_trunc('week', queued_at)::date as \"weekStart\", count(*) as value from report_runs "
                + "where queued_at >= date_trunc('week', now()) - interval '5 weeks'" + scope + " group by 1 order by 1", args);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runsPerWeek", weeks);
        result.put("runsLast30Days", count("select count(*) from report_runs where queued_at > now() - interval '30 days'" + scope, args));
        result.put("failedLast30Days", count("select count(*) from report_runs where status='FAILED' and queued_at > now() - interval '30 days'" + scope, args));
        result.put("fullRunsLast30Days", count("select count(*) from report_runs where full_run and queued_at > now() - interval '30 days'" + scope, args));
        result.put("allUsers", all);
        return result;
    }
}
