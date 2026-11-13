package com.eqms.backup.agent.drill;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The Disaster Recovery Plan (SDS 15.2): the recovery targets (changed only with an approval by electronic signature, kept with their
 * history), the rebuild kit (what a rebuild needs, and when a person last verified each item), and the person who may declare a disaster.
 * The system never records a verification by itself.
 */
@Service
public class DrPlanService {

    public static final String AUTHORITY_KEY = "DECLARATION_AUTHORITY";
    private static final double MAX_HOURS = 24 * 365;

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;

    public DrPlanService(JdbcTemplate jdbc, LedgerService ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    /** The scenarios with their recovery targets. */
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

    /** Changes the targets of one scenario. The signature reference is required; the change is kept with its history. */
    public Map<String, Object> changeTargets(String scenarioCode, double rpo, double rto, String by, String reason, String signatureRef) {
        String who = required(by, "PERSON_REQUIRED", "Who is changing the targets must be known");
        String why = required(reason, "DR_REASON_REQUIRED", "A reason is required");
        String sig = required(signatureRef, "SIGNATURE_REQUIRED", "An electronic signature is required to change the recovery targets");
        if (!(rpo > 0) || !(rto > 0) || rpo > MAX_HOURS || rto > MAX_HOURS) {
            throw ExportException.invalid("DR_TARGET_INVALID", "RPO and RTO must be more than 0 and at most " + (int) MAX_HOURS + " hours");
        }
        Map<String, Object> cur = jdbc.queryForList("select rpo_hours, rto_hours from dr_scenario where code = ?", scenarioCode).stream().findFirst()
                .orElseThrow(() -> ExportException.notFound("DR_SCENARIO_NOT_FOUND", "There is no scenario " + scenarioCode));
        double oldRpo = ((Number) cur.get("rpo_hours")).doubleValue();
        double oldRto = ((Number) cur.get("rto_hours")).doubleValue();
        if (oldRpo == rpo && oldRto == rto) throw ExportException.conflict("DR_TARGET_UNCHANGED", "The targets are already " + rpo + " and " + rto + " hours");
        jdbc.update("insert into dr_target_history(scenario_code, old_rpo_hours, new_rpo_hours, old_rto_hours, new_rto_hours, changed_by, reason, signature_ref) "
                + "values (?,?,?,?,?,?,?,?)", scenarioCode, oldRpo, rpo, oldRto, rto, who, why, sig);
        jdbc.update("update dr_scenario set rpo_hours = ?, rto_hours = ?, status = 'APPROVED', approved_by = ?, approved_at = now() where code = ?",
                rpo, rto, who, scenarioCode);
        ledger.append(who, "DR_TARGET_CHANGED", scenarioCode, Map.of("rpoFrom", oldRpo, "rpoTo", rpo, "rtoFrom", oldRto, "rtoTo", rto, "signatureRef", sig));
        return Map.of("code", scenarioCode, "rpoHours", rpo, "rtoHours", rto, "status", "APPROVED");
    }

    public List<Map<String, Object>> kit() {
        return kit(365);
    }

    /** An item checked longer ago than {@code reviewDays} is shown as overdue (the limit of the alert rule). */
    public List<Map<String, Object>> kit(int reviewDays) {
        List<Map<String, Object>> out = new ArrayList<>();
        jdbc.queryForList("select i.code, i.label, i.detail, v.verified_at, v.verified_by, v.note from rebuild_kit_item i "
                + "left join lateral (select verified_at, verified_by, note from rebuild_kit_verification where item_code = i.code order by verified_at desc limit 1) v on true "
                + "order by i.sort_order").forEach(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", row.get("code"));
            m.put("label", row.get("label"));
            m.put("detail", row.get("detail"));
            m.put("lastVerifiedAt", row.get("verified_at") instanceof Timestamp t ? t.toInstant().toString() : null);
            m.put("lastVerifiedBy", row.get("verified_by"));
            m.put("note", row.get("note"));
            Timestamp last = (Timestamp) row.get("verified_at");
            m.put("state", last == null ? "NOT_VERIFIED" : last.toInstant().isBefore(Instant.now().minus(Duration.ofDays(reviewDays))) ? "OVERDUE" : "VERIFIED");
            m.put("reviewDays", reviewDays);
            out.add(m);
        });
        return out;
    }

    /** A person has checked the item. The system only records it; the date is the date of the check, not of the entry. */
    public Map<String, Object> verifyKitItem(String code, Instant verifiedAt, String by, String note) {
        String who = required(by, "PERSON_REQUIRED", "Who verified the item must be known");
        if (verifiedAt == null) throw ExportException.invalid("VERIFIED_AT_REQUIRED", "The date of the check is required");
        if (verifiedAt.isAfter(Instant.now().plus(Duration.ofDays(1)))) throw ExportException.invalid("VERIFIED_AT_FUTURE", "A check cannot be recorded for a date in the future");
        int n = jdbc.queryForObject("select count(*) from rebuild_kit_item where code = ?", Integer.class, code);
        if (n == 0) throw ExportException.notFound("KIT_ITEM_NOT_FOUND", "There is no rebuild kit item " + code);
        String text = note == null ? null : note.trim();
        jdbc.update("insert into rebuild_kit_verification(item_code, verified_at, verified_by, note) values (?,?,?,?)",
                code, Timestamp.from(verifiedAt), who, text == null || text.isEmpty() ? null : text);
        ledger.append(who, "DR_KIT_VERIFIED", code, Map.of("verifiedAt", verifiedAt.toString()));
        return Map.of("code", code, "verifiedBy", who, "verifiedAt", verifiedAt.toString());
    }

    public String declarationAuthority() {
        return jdbc.queryForObject("select value from dr_plan_setting where key = ?", String.class, AUTHORITY_KEY);
    }

    public Map<String, Object> changeDeclarationAuthority(String value, String by, String reason, String signatureRef) {
        String who = required(by, "PERSON_REQUIRED", "Who is changing the setting must be known");
        String why = required(reason, "DR_REASON_REQUIRED", "A reason is required");
        String sig = required(signatureRef, "SIGNATURE_REQUIRED", "An electronic signature is required");
        String next = required(value, "DR_AUTHORITY_REQUIRED", "The person or role who may declare a disaster is required (at most 200 characters)");
        if (next.length() > 200) throw ExportException.invalid("DR_AUTHORITY_REQUIRED", "At most 200 characters");
        String old = declarationAuthority();
        if (old.equals(next)) throw ExportException.conflict("DR_SETTING_UNCHANGED", "The declaration authority is already " + next);
        jdbc.update("insert into dr_plan_setting_history(key, old_value, new_value, changed_by, reason) values (?,?,?,?,?)", AUTHORITY_KEY, old, next, who, why);
        jdbc.update("update dr_plan_setting set value = ?, updated_by = ?, updated_at = now() where key = ?", next, who, AUTHORITY_KEY);
        ledger.append(who, "DR_AUTHORITY_CHANGED", AUTHORITY_KEY, Map.of("from", old, "to", next, "signatureRef", sig));
        return Map.of("key", AUTHORITY_KEY, "value", next, "previous", old);
    }


    private static final Map<String, String> DECLARATION_SORT = Map.of("declaredAt", "d.declared_at", "code", "d.declaration_code", "scenario", "s.label",
            "status", "d.status", "closedAt", "d.closed_at", "timeTaken", "(d.closed_at - d.declared_at)", "declaredBy", "d.declared_by");

    private static String like(String search) {
        return "%" + search.trim().toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static Map<String, Object> paged(List<Map<String, Object>> rows, Long total, int no, int size) {
        long count = total == null ? 0 : total;
        Map<String, Object> pagination = new LinkedHashMap<>();
        pagination.put("page", no);
        pagination.put("limit", size);
        pagination.put("total", count);
        pagination.put("totalPages", Math.max(1, (int) Math.ceil(count / (double) size)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", rows);
        out.put("pagination", pagination);
        return out;
    }

    // ------------------------------------------------------------------ readiness: the targets against what is true now

    /**
     * For each scenario, the target next to what the records show now. The data age is how old the newest backup that passed its integrity
     * check is (for a site loss or ransomware: the newest one that also reached T2, since T1 is lost or untrusted). The recovery time is how
     * long the newest passed test restore took. These are facts read from the records; nothing here is a promise.
     */
    public List<Map<String, Object>> readiness() {
        Double verifiedAge = hoursSince("select max(r.started_at) from backup_run r where r.status = 'COMPLETED' and exists "
                + "(select 1 from backup_verification v where v.run_id = r.id and v.result = 'VERIFIED')");
        Double copiedAge = hoursSince("select max(r.started_at) from backup_run r where r.status = 'COMPLETED' and exists "
                + "(select 1 from backup_set_location l where l.run_id = r.id and l.target_code <> 'T1' and l.ok) and exists "
                + "(select 1 from backup_verification v where v.run_id = r.id and v.result = 'VERIFIED')");
        List<Integer> rehearsal = jdbc.queryForList("select restore_seconds from restore_rehearsal where status = 'PASSED' and restore_seconds is not null order by finished_at desc limit 1", Integer.class);
        Integer seconds = rehearsal.isEmpty() ? null : rehearsal.get(0);
        Double achievedRto = seconds == null ? null : seconds / 3600.0;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> s : scenarios()) {
            String code = (String) s.get("code");
            boolean offsite = "SITE_LOSS".equals(code) || "RANSOMWARE".equals(code);
            Double age = offsite ? copiedAge : verifiedAge;
            double rpo = ((Number) s.get("rpoHours")).doubleValue();
            double rto = ((Number) s.get("rtoHours")).doubleValue();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("scenario", code);
            m.put("dataSource", offsite ? "NEWEST_VERIFIED_COPY_ON_T2" : "NEWEST_VERIFIED_BACKUP");
            m.put("dataAgeHours", age);
            m.put("rpoHours", rpo);
            m.put("rpoState", age == null ? "NO_DATA" : age <= rpo ? "WITHIN" : "EXCEEDED");
            m.put("testedRestoreSeconds", seconds);
            m.put("testedRestoreHours", achievedRto == null ? null : Math.round(achievedRto * 100.0) / 100.0);
            m.put("rtoHours", rto);
            m.put("rtoState", achievedRto == null ? "NOT_TESTED" : achievedRto <= rto ? "WITHIN" : "EXCEEDED");
            out.add(m);
        }
        return out;
    }

    private Double hoursSince(String sql) {
        Timestamp t = jdbc.queryForObject(sql, Timestamp.class);
        return t == null ? null : Math.round(Duration.between(t.toInstant(), Instant.now()).toMinutes() / 6.0) / 10.0;
    }

    // ------------------------------------------------------------------ declaring a disaster

    public Map<String, Object> declarations(int page, int limit) {
        return declarations(null, null, null, null, null, null, false, page, limit);
    }

    public Map<String, Object> declarations(String search, String status, String scenario, Instant from, Instant to, String sortBy, boolean ascending, int page, int limit) {
        return declarations(search, status, scenario, from, to, sortBy, ascending, page, limit, List.of());
    }

    public Map<String, Object> declarations(String search, String status, String scenario, Instant from, Instant to, String sortBy, boolean ascending, int page, int limit, List<String> people) {
        int size = Math.min(Math.max(limit, 1), 100);
        int no = Math.max(page, 1);
        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> filter = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            String st = status.trim().toUpperCase();
            if (!st.equals("OPEN") && !st.equals("CLOSED")) throw ExportException.invalid("DR_DECLARATION_STATUS", "The status must be OPEN or CLOSED");
            where.append(" and d.status = ?");
            filter.add(st);
        }
        if (scenario != null && !scenario.isBlank()) {
            where.append(" and d.scenario_code = ?");
            filter.add(scenario.trim());
        }
        if (search != null && !search.isBlank()) {
            new com.eqms.backup.agent.api.SearchClause(search)
                    .text("lower(d.declaration_code)").text("lower(s.label)").text("lower(d.declared_reason)").text("lower(d.declared_by)")
                    .text("lower(coalesce(d.closed_summary,''))").text("lower(d.status)")
                    .date("d.declared_at").date("d.closed_at")
                    .people(people, "d.declared_by")
                    .appendTo(where, filter);
        }
        if (from != null) {
            where.append(" and d.declared_at >= ?");
            filter.add(Timestamp.from(from));
        }
        if (to != null) {
            where.append(" and d.declared_at <= ?");
            filter.add(Timestamp.from(to));
        }
        String order = DECLARATION_SORT.getOrDefault(sortBy == null ? "" : sortBy, "d.declared_at") + (ascending ? " asc" : " desc") + " nulls last, d.declared_at desc";
        Long total = jdbc.queryForObject("select count(*) from dr_declaration d join dr_scenario s on s.code = d.scenario_code" + where, Long.class, filter.toArray());
        List<Object> pageArgs = new ArrayList<>(filter);
        pageArgs.add(size);
        pageArgs.add((no - 1) * size);
        List<Map<String, Object>> rows = new ArrayList<>();
        jdbc.queryForList("select d.declaration_code, d.scenario_code, s.label, d.status, d.declared_by, d.declared_at, d.declared_reason, d.rpo_target_hours, d.rto_target_hours, "
                + "d.closed_by, d.closed_at, d.closed_summary from dr_declaration d join dr_scenario s on s.code = d.scenario_code "
                + where + " order by " + order + " limit ? offset ?", pageArgs.toArray()).forEach(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", row.get("declaration_code"));
            m.put("scenario", row.get("scenario_code"));
            m.put("scenarioLabel", row.get("label"));
            m.put("status", row.get("status"));
            m.put("declaredBy", row.get("declared_by"));
            Timestamp declared = (Timestamp) row.get("declared_at");
            m.put("declaredAt", declared.toInstant().toString());
            m.put("reason", row.get("declared_reason"));
            m.put("rpoTargetHours", row.get("rpo_target_hours"));
            m.put("rtoTargetHours", row.get("rto_target_hours"));
            m.put("closedBy", row.get("closed_by"));
            Timestamp closed = (Timestamp) row.get("closed_at");
            m.put("closedAt", closed == null ? null : closed.toInstant().toString());
            m.put("summary", row.get("closed_summary"));
            m.put("hoursTaken", closed == null ? null : Math.round(Duration.between(declared.toInstant(), closed.toInstant()).toMinutes() / 6.0) / 10.0);
            rows.add(m);
        });
        return paged(rows, total, no, size);
    }

    /** Opens a declaration. The backend has checked that {@code by} is the declaration authority; here the plan checks the rest. */
    public Map<String, Object> declare(String scenarioCode, String reason, String by, String signatureRef) {
        String who = required(by, "PERSON_REQUIRED", "Who is declaring must be known");
        String why = required(reason, "DR_REASON_REQUIRED", "A reason is required");
        String sig = required(signatureRef, "SIGNATURE_REQUIRED", "An electronic signature is required to declare a disaster");
        if (why.length() > 1000) throw ExportException.invalid("DR_REASON_REQUIRED", "The reason is at most 1000 characters");
        Map<String, Object> scenario = jdbc.queryForList("select rpo_hours, rto_hours from dr_scenario where code = ?", scenarioCode).stream().findFirst()
                .orElseThrow(() -> ExportException.notFound("DR_SCENARIO_NOT_FOUND", "There is no scenario " + scenarioCode));
        Integer open = jdbc.queryForObject("select count(*) from dr_declaration where status = 'OPEN'", Integer.class);
        if (open != null && open > 0) throw ExportException.conflict("DR_DECLARATION_OPEN", "A disaster is already declared and not yet closed");
        Long seq = jdbc.queryForObject("select nextval('dr_declaration_seq')", Long.class);
        String code = "DR-" + java.time.Year.now().getValue() + "-" + String.format("%04d", seq);
        jdbc.update("insert into dr_declaration(declaration_code, scenario_code, declared_by, declared_reason, declare_signature_ref, rpo_target_hours, rto_target_hours) values (?,?,?,?,?,?,?)",
                code, scenarioCode, who, why, sig, scenario.get("rpo_hours"), scenario.get("rto_hours"));
        ledger.append(who, "DR_DECLARED", code, Map.of("scenario", scenarioCode, "reason", why, "signatureRef", sig));
        return Map.of("code", code, "scenario", scenarioCode, "status", "OPEN");
    }

    /** Closes the open declaration when service is restored. */
    public Map<String, Object> closeDeclaration(String code, String summary, String by, String signatureRef) {
        String who = required(by, "PERSON_REQUIRED", "Who is closing must be known");
        String text = required(summary, "DR_SUMMARY_REQUIRED", "Say how service was restored and what was found");
        String sig = required(signatureRef, "SIGNATURE_REQUIRED", "An electronic signature is required to close a declaration");
        if (text.length() > 2000) throw ExportException.invalid("DR_SUMMARY_REQUIRED", "The summary is at most 2000 characters");
        String status = jdbc.queryForList("select status from dr_declaration where declaration_code = ?", String.class, code).stream().findFirst()
                .orElseThrow(() -> ExportException.notFound("DR_DECLARATION_NOT_FOUND", "There is no declaration " + code));
        if (!"OPEN".equals(status)) throw ExportException.conflict("DR_DECLARATION_CLOSED", "This declaration is already closed");
        jdbc.update("update dr_declaration set status = 'CLOSED', closed_by = ?, closed_at = now(), closed_summary = ?, close_signature_ref = ? where declaration_code = ? and status = 'OPEN'",
                who, text, sig, code);
        ledger.append(who, "DR_DECLARATION_CLOSED", code, Map.of("summary", text, "signatureRef", sig));
        return Map.of("code", code, "status", "CLOSED");
    }

    private static String required(String value, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty()) throw ExportException.invalid(code, message);
        return t;
    }
}
