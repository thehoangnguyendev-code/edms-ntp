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
            m.put("state", row.get("verified_at") == null ? "NOT_VERIFIED" : "VERIFIED");
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

    private static String required(String value, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty()) throw ExportException.invalid(code, message);
        return t;
    }
}
