package com.eqms.backup.agent.drill;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Disaster recovery drills (SDS 15.2): the scenarios with their proposed targets, and the record of each drill. A drill's targets are
 * copied from the scenario when it is recorded, so a later change of target does not rewrite history. A drill that took longer than
 * its recovery target cannot be recorded as PASSED.
 */
@Service
public class DrDrillService {

    static final Set<String> RESULTS = Set.of("PASSED", "PASSED_WITH_FINDINGS", "FAILED");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;

    public DrDrillService(JdbcTemplate jdbc, LedgerService ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    public List<Map<String, Object>> scenarios() {
        List<Map<String, Object>> out = new ArrayList<>();
        jdbc.queryForList("select code, label, description, rpo_hours, rto_hours, status, approved_by, approved_at from dr_scenario order by code").forEach(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", row.get("code"));
            m.put("label", row.get("label"));
            m.put("description", row.get("description"));
            m.put("rpoHours", row.get("rpo_hours"));
            m.put("rtoHours", row.get("rto_hours"));
            m.put("status", row.get("status"));
            m.put("approvedBy", row.get("approved_by"));
            m.put("approvedAt", row.get("approved_at") instanceof Timestamp t ? t.toInstant().toString() : null);
            out.add(m);
        });
        return out;
    }

    /** The recorded drills, searched, filtered and sorted on the server. Unknown sort keys fall back to the date of the drill. */
    public Map<String, Object> page(String search, String scenario, String result, String sortBy, boolean ascending, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (scenario != null && !scenario.isBlank()) {
            where.append(" and scenario_code = ?");
            args.add(scenario.trim().toUpperCase(Locale.ROOT));
        }
        if (result != null && !result.isBlank()) {
            where.append(" and result = ?");
            args.add(result.trim().toUpperCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(drill_code) like ? or lower(lead) like ? or lower(scenario_code) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 3; i++) args.add(like);
        }
        String column = switch (sortBy == null ? "" : sortBy) {
            case "drillCode" -> "drill_code";
            case "scenario" -> "scenario_code";
            case "lead" -> "lead";
            case "achievedRtoHours" -> "achieved_rto_hours";
            case "result" -> "result";
            default -> "performed_at";
        };
        Long total = jdbc.queryForObject("select count(*) from dr_drill" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select drill_code, scenario_code, performed_at, lead, rpo_target_hours, rto_target_hours, "
                + "achieved_rto_hours, result, findings, recorded_by, recorded_at from dr_drill" + where + " order by " + column + (ascending ? " asc" : " desc")
                + ", drill_code desc limit ? offset ?", pageArgs.toArray()).stream().map(DrDrillService::view).toList();
        long count = total == null ? 0 : total;
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", safePage);
        pagination.put("limit", safeLimit);
        pagination.put("total", count);
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(count / (double) safeLimit)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", rows);
        out.put("pagination", pagination);
        return out;
    }

    /** Records a drill that has been carried out. Nothing about it can be edited afterwards. */
    public Map<String, Object> record(String scenarioCode, Instant performedAt, String lead, double achievedRtoHours, String result, String findings, String by) {
        String who = required(by, "PERSON_REQUIRED", "Who is recording the drill must be known");
        String name = required(lead, "DRILL_LEAD_REQUIRED", "The person who led the drill is required (at most 120 characters)");
        if (name.length() > 120) throw ExportException.invalid("DRILL_LEAD_REQUIRED", "The person who led the drill is required (at most 120 characters)");
        String scenario = scenarioCode == null ? "" : scenarioCode.trim().toUpperCase(Locale.ROOT);
        Map<String, Object> target = jdbc.queryForList("select rpo_hours, rto_hours from dr_scenario where code = ?", scenario).stream().findFirst()
                .orElseThrow(() -> ExportException.invalid("DRILL_SCENARIO_UNKNOWN", "The scenario must be one of the scenarios in the plan"));
        if (performedAt == null) throw ExportException.invalid("DRILL_DATE_REQUIRED", "The date of the drill is required");
        if (performedAt.isAfter(Instant.now().plus(Duration.ofDays(1)))) throw ExportException.invalid("DRILL_IN_FUTURE", "A drill cannot be recorded for a date in the future");
        if (!(achievedRtoHours >= 0) || achievedRtoHours > 24 * 30) throw ExportException.invalid("DRILL_TIME_INVALID", "The time achieved must be between 0 and 720 hours");
        if (!RESULTS.contains(result)) throw ExportException.invalid("DRILL_RESULT_UNKNOWN", "The result must be one of " + RESULTS);
        double rto = ((Number) target.get("rto_hours")).doubleValue();
        if (result.equals("PASSED") && achievedRtoHours > rto) {
            throw ExportException.invalid("DRILL_OVER_TARGET", "A drill that took " + achievedRtoHours + " hours cannot be PASSED against a target of " + rto + " hours");
        }
        String notes = findings == null ? null : findings.trim();
        if (!result.equals("PASSED") && (notes == null || notes.isEmpty())) {
            throw ExportException.invalid("DRILL_FINDINGS_REQUIRED", "Findings are required when the drill did not pass cleanly");
        }
        Long seq = jdbc.queryForObject("select nextval('dr_drill_seq')", Long.class);
        String code = "DR-" + DAY.format(Instant.now()) + "-" + String.format("%03d", seq);
        jdbc.update("insert into dr_drill(drill_code, scenario_code, performed_at, lead, rpo_target_hours, rto_target_hours, achieved_rto_hours, result, findings, recorded_by) "
                        + "values (?,?,?,?,?,?,?,?,?,?)", code, scenario, Timestamp.from(performedAt), name,
                target.get("rpo_hours"), target.get("rto_hours"), achievedRtoHours, result, notes == null || notes.isEmpty() ? null : notes, who);
        ledger.append(who, "DR_DRILL_RECORDED", code, Map.of("scenario", scenario, "result", result, "achievedRtoHours", achievedRtoHours));
        return view(jdbc.queryForMap("select drill_code, scenario_code, performed_at, lead, rpo_target_hours, rto_target_hours, achieved_rto_hours, "
                + "result, findings, recorded_by, recorded_at from dr_drill where drill_code = ?", code));
    }

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("drillCode", row.get("drill_code"));
        m.put("scenario", row.get("scenario_code"));
        m.put("performedAt", row.get("performed_at") instanceof Timestamp t ? t.toInstant().toString() : null);
        m.put("lead", row.get("lead"));
        m.put("rpoTargetHours", row.get("rpo_target_hours"));
        m.put("rtoTargetHours", row.get("rto_target_hours"));
        m.put("achievedRtoHours", row.get("achieved_rto_hours"));
        m.put("result", row.get("result"));
        m.put("findings", row.get("findings"));
        m.put("recordedBy", row.get("recorded_by"));
        m.put("recordedAt", row.get("recorded_at") instanceof Timestamp t ? t.toInstant().toString() : null);
        return m;
    }

    private static String required(String value, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty()) throw ExportException.invalid(code, message);
        return t;
    }
}
