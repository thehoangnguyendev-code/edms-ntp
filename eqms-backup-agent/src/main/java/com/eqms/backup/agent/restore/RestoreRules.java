package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The owner-changeable restore rules (table restore_rule, V15). A change is refused outside the defined range, is kept in
 * restore_rule_history with who, when, why and the electronic signature reference, and is written to the ledger. The backend
 * requires the signature before it calls this.
 */
@Component
public class RestoreRules {

    public static final String REHEARSAL_MAX_AGE_DAYS = "REHEARSAL_MAX_AGE_DAYS";
    public static final String RESTORE_DRILL_INTERVAL_DAYS = "RESTORE_DRILL_INTERVAL_DAYS";

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;

    public RestoreRules(JdbcTemplate jdbc, LedgerService ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    /** The current value of a rule. A rule that is missing is an error: the restore must not fall back to a guessed value. */
    public int value(String code) {
        Integer v = jdbc.query("select int_value from restore_rule where code = ?", rs -> rs.next() ? rs.getInt(1) : null, code);
        if (v == null) throw new IllegalStateException("The restore rule " + code + " is not defined");
        return v;
    }

    public List<Map<String, Object>> all() {
        List<Map<String, Object>> out = new ArrayList<>();
        jdbc.query("select code, int_value, min_value, max_value, description, updated_by, updated_at from restore_rule order by code", rs -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", rs.getString("code"));
            m.put("value", rs.getInt("int_value"));
            m.put("min", rs.getInt("min_value"));
            m.put("max", rs.getInt("max_value"));
            m.put("description", rs.getString("description"));
            m.put("updatedBy", rs.getString("updated_by"));
            m.put("updatedAt", ((Timestamp) rs.getTimestamp("updated_at")).toInstant().toString());
            out.add(m);
        });
        return out;
    }

    /** Changes one rule. The value must be a whole number inside the rule's range, the reason is required. */
    public Map<String, Object> change(String code, int newValue, String by, String reason, String signatureRef) {
        String who = by == null || by.isBlank() ? null : by.trim();
        if (who == null) throw ExportException.invalid("PERSON_REQUIRED", "Who is changing the rule must be known");
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty() || why.length() > 500) throw ExportException.invalid("RULE_REASON_REQUIRED", "A reason is required (at most 500 characters)");
        Map<String, Object> row = jdbc.queryForList("select int_value, min_value, max_value from restore_rule where code = ?", code).stream().findFirst()
                .orElseThrow(() -> ExportException.notFound("RULE_NOT_FOUND", "There is no restore rule " + code));
        int min = (Integer) row.get("min_value");
        int max = (Integer) row.get("max_value");
        if (newValue < min || newValue > max) {
            throw ExportException.invalid("RULE_OUT_OF_RANGE", code + " must be between " + min + " and " + max);
        }
        int old = (Integer) row.get("int_value");
        if (old == newValue) throw ExportException.conflict("RULE_UNCHANGED", code + " already has the value " + newValue);
        jdbc.update("update restore_rule set int_value = ?, updated_by = ?, updated_at = now() where code = ?", newValue, who, code);
        jdbc.update("insert into restore_rule_history(code, old_value, new_value, changed_by, reason, signature_ref) values (?,?,?,?,?,?)",
                code, old, newValue, who, why, signatureRef);
        ledger.append(who, "RESTORE_RULE_CHANGED", code, Map.of("from", old, "to", newValue, "reason", why,
                "signatureRef", signatureRef == null ? "" : signatureRef));
        return Map.of("code", code, "value", newValue, "previous", old);
    }
}
