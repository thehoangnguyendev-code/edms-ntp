package com.eqms.backup.agent.api;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read model behind the screens: filtering, sorting and paging all happen here, in the database. */
@Service
public class BackupQueryService {

    /** Sort keys the API accepts, mapped to fixed SQL. Anything else falls back to the start time; nothing user-typed reaches SQL. */
    private static final Map<String, String> SORT = Map.of(
            "startedAt", "r.started_at",
            "backupNumber", "r.backup_number",
            "status", "r.status",
            "type", "r.type",
            "sizeBytes", "r.size_bytes",
            "createdBy", "r.requested_by",
            "verification", "coalesce(v.result, 'NOT_VERIFIED')",
            "verifiedAt", "v.verified_at");

    public record Query(String search, String status, String type, String verification, Instant startedFrom, Instant startedTo, Instant checkedFrom, Instant checkedTo, String sortBy, boolean ascending, int page, int limit) {
    }

    public record Page(List<Map<String, Object>> data, int page, int limit, long total) {
    }

    private final JdbcTemplate jdbc;

    public BackupQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Page list(Query q) {
        int limit = Math.min(Math.max(q.limit(), 1), 100);
        int page = Math.max(q.page(), 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (hasText(q.search())) {
            where.append(" and (lower(r.backup_number) like ? or lower(r.requested_by) like ? or lower(coalesce(r.reason,'')) like ?)");
            String like = "%" + q.search().trim().toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        if (hasText(q.status()) && !"ALL".equals(q.status())) {
            where.append(" and r.status = ?");
            args.add(q.status());
        }
        if (hasText(q.type()) && !"ALL".equals(q.type())) {
            where.append(" and r.type = ?");
            args.add(q.type());
        }
        if (q.startedFrom() != null) {
            where.append(" and r.started_at >= ?");
            args.add(Timestamp.from(q.startedFrom()));
        }
        if (q.startedTo() != null) {
            where.append(" and r.started_at <= ?");
            args.add(Timestamp.from(q.startedTo()));
        }
        // "checked" is the time of the latest integrity result; a backup never checked has none and is left out of a range
        if (q.checkedFrom() != null) {
            where.append(" and v.verified_at >= ?");
            args.add(Timestamp.from(q.checkedFrom()));
        }
        if (q.checkedTo() != null) {
            where.append(" and v.verified_at <= ?");
            args.add(Timestamp.from(q.checkedTo()));
        }
        if (hasText(q.verification()) && !"ALL".equals(q.verification())) {
            where.append(" and coalesce(v.result, 'NOT_VERIFIED') = ?");
            args.add(q.verification());
        }
        String from = " from backup_run r left join lateral (select result, verified_at from backup_verification where run_id = r.id and tier = 'V1' "
                + "order by verified_at desc limit 1) v on true left join backup_manifest m on m.run_id = r.id";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        String order = SORT.getOrDefault(q.sortBy() == null ? "" : q.sortBy(), "r.started_at") + (q.ascending() ? " asc" : " desc") + " nulls last, r.started_at desc";
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(limit);
        pageArgs.add((long) (page - 1) * limit);
        List<Map<String, Object>> rows = jdbc.query(
                "select r.id, r.backup_number, r.type, r.trigger_kind, r.status, r.started_at, r.finished_at, r.size_bytes, r.requested_by, r.reason, r.error_code, r.error_detail, "
                        + "r.change_control_ref, coalesce(v.result, 'NOT_VERIFIED') as verification, v.verified_at, (m.manifest_text::jsonb->'app'->>'flywayLatest') as schema_version"
                        + from + where + " order by " + order + " limit ? offset ?",
                (rs, i) -> view(rs), pageArgs.toArray());
        attachComponents(rows);
        rows.forEach(r -> r.remove("_runId"));
        return new Page(rows, page, limit, total == null ? 0 : total);
    }

    public Optional<Map<String, Object>> get(String backupNumber) {
        List<Map<String, Object>> rows = jdbc.query(
                "select r.id, r.backup_number, r.type, r.trigger_kind, r.status, r.started_at, r.finished_at, r.size_bytes, r.requested_by, r.reason, r.error_code, r.error_detail, "
                        + "r.change_control_ref, coalesce(v.result, 'NOT_VERIFIED') as verification, v.verified_at, (m.manifest_text::jsonb->'app'->>'flywayLatest') as schema_version "
                        + "from backup_run r left join lateral (select result, verified_at from backup_verification where run_id = r.id and tier = 'V1' order by verified_at desc limit 1) v on true "
                        + "left join backup_manifest m on m.run_id = r.id where r.backup_number = ?",
                (rs, i) -> view(rs), backupNumber);
        attachComponents(rows);
        if (rows.isEmpty()) return Optional.empty();
        Map<String, Object> view = rows.get(0);
        view.put("locations", jdbc.queryForList("select target_code as target, path, ok from backup_set_location where run_id = ?::uuid", String.valueOf(view.get("_runId"))));
        view.put("verifications", jdbc.queryForList("select tier, result, verified_at, verified_by, detail_json::text as detail from backup_verification where run_id = ?::uuid order by verified_at desc limit 20",
                String.valueOf(view.get("_runId"))));
        view.remove("_runId");
        return Optional.of(view);
    }

    public Map<String, Object> overview(String environment) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("environment", environment);
        Map<String, Object> counts = jdbc.queryForMap("select count(*) filter (where status='COMPLETED') as completed, count(*) filter (where status='FAILED') as failed, "
                + "count(*) filter (where status='RUNNING') as running from backup_run");
        out.put("completed", counts.get("completed"));
        out.put("failed", counts.get("failed"));
        out.put("running", counts.get("running"));
        out.put("lastCompleted", jdbc.query("select backup_number, finished_at, size_bytes from backup_run where status='COMPLETED' order by started_at desc limit 1",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("backupNumber", rs.getString(1));
                    m.put("finishedAt", rs.getTimestamp(2).toInstant().toString());
                    m.put("sizeBytes", rs.getLong(3));
                    return m;
                }).stream().findFirst().orElse(null));
        out.put("notVerified", jdbc.queryForObject("select count(*) from backup_run r where r.status='COMPLETED' and not exists "
                + "(select 1 from backup_verification v where v.run_id = r.id and v.tier='V1' and v.result='VERIFIED' and v.verified_at = "
                + "(select max(verified_at) from backup_verification where run_id = r.id and tier='V1'))", Long.class));
        out.put("openAlerts", jdbc.query("select id, at, severity, code, detail, ref from backup_alert where acknowledged_at is null order by at desc limit 20",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("at", rs.getTimestamp("at").toInstant().toString());
                    m.put("severity", rs.getString("severity"));
                    m.put("code", rs.getString("code"));
                    m.put("detail", rs.getString("detail"));
                    m.put("ref", rs.getString("ref"));
                    return m;
                }));
        return out;
    }

    /**
     * One row per day for the last {@code days} days, today included, oldest first. A day with no runs is still a row,
     * with zeros, so the chart keeps its spacing. Days follow the database session's time zone.
     */
    public List<Map<String, Object>> dailySummary(int days) {
        return jdbc.query("with runs as (select r.started_at, r.status, (r.status='COMPLETED' and not exists "
                + "(select 1 from backup_verification v where v.run_id = r.id and v.tier='V1' and v.result='VERIFIED' and v.verified_at = "
                + "(select max(verified_at) from backup_verification where run_id = r.id and tier='V1'))) as unverified "
                + "from backup_run r where r.started_at >= current_date - (? - 1) * interval '1 day') "
                + "select d::date as day, count(runs.status) filter (where runs.status='COMPLETED') as completed, "
                + "count(runs.status) filter (where runs.status='FAILED') as failed, "
                + "count(runs.status) filter (where runs.unverified) as not_verified "
                + "from generate_series(current_date - (? - 1) * interval '1 day', current_date, interval '1 day') d "
                + "left join runs on cast(runs.started_at as date) = d::date "
                + "group by d order by d",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("date", rs.getDate("day").toLocalDate().toString());
                    m.put("completed", rs.getLong("completed"));
                    m.put("failed", rs.getLong("failed"));
                    m.put("notVerified", rs.getLong("not_verified"));
                    return m;
                },
                days, days);
    }

    public Map<String, Object> activePolicy() {
        return jdbc.queryForList("select version, status, scope_json::text as scope, schedule_json::text as schedule, retention_json::text as retention, targets_json::text as targets, created_at from backup_policy where status='ACTIVE'")
                .stream().findFirst().orElse(null);
    }

    private Map<String, Object> view(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        Timestamp started = rs.getTimestamp("started_at");
        Timestamp finished = rs.getTimestamp("finished_at");
        m.put("_runId", rs.getString("id"));
        m.put("id", rs.getString("backup_number"));
        m.put("type", rs.getString("type"));
        m.put("trigger", rs.getString("trigger_kind"));
        m.put("status", rs.getString("status"));
        m.put("startedAt", started.toInstant().toString());
        m.put("durationSec", finished == null ? null : (finished.getTime() - started.getTime()) / 1000);
        long size = rs.getLong("size_bytes");
        m.put("sizeBytes", rs.wasNull() ? null : size);
        m.put("verification", rs.getString("verification"));
        Timestamp verifiedAt = rs.getTimestamp("verified_at");
        m.put("verifiedAt", verifiedAt == null ? null : verifiedAt.toInstant().toString());
        m.put("schemaVersion", rs.getString("schema_version"));
        m.put("createdBy", rs.getString("requested_by"));
        m.put("reason", rs.getString("reason"));
        m.put("changeControlRef", rs.getString("change_control_ref"));
        m.put("errorCode", rs.getString("error_code"));
        m.put("errorMessage", rs.getString("error_detail"));
        m.put("legalHold", false);
        m.put("retention", "PERMANENT");
        return m;
    }

    private void attachComponents(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            UUID runId = UUID.fromString((String) row.get("_runId"));
            row.put("components", jdbc.query("select component, status, size_bytes, sha256 from backup_component_result where run_id = ? order by component",
                    (rs, i) -> {
                        Map<String, Object> c = new LinkedHashMap<>();
                        c.put("key", rs.getString(1));
                        c.put("status", rs.getString(2));
                        long size = rs.getLong(3);
                        c.put("sizeBytes", rs.wasNull() ? 0L : size);
                        c.put("sha256", rs.getString(4));
                        return c;
                    }, runId));
        }
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    static Instant now() {
        return Instant.now();
    }
}
