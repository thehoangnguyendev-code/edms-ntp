package com.eqms.backup.agent.alert;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Alert rules (SDS 15.1). An alert is always recorded and shown. A rule chooses who is told about it (in the application, by e-mail) and,
 * for the alerts that have one, the limit at which it is raised. Each change needs a reason and is written to the ledger and, by the backend, to the eQMS audit trail.
 * The agent cannot send a message itself: it hands the alerts that are still to be told to the eQMS backend, which delivers them and
 * then says they are done.
 */
@Service
public class AlertRuleService {

    private static final int MAX_REASON = 500;

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;

    public AlertRuleService(JdbcTemplate jdbc, LedgerService ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    /** The rule an alert code belongs to; null when no rule covers it (it is then told in the application only). */
    public static String ruleOf(String alertCode) {
        if (alertCode == null) return null;
        return switch (alertCode) {
            case "BACKUP_MISSED", "BACKUP_VERIFY_FAILED", "BACKUP_COPY_FAILED", "TARGET_UNREACHABLE", "CAPACITY_HIGH", "MANUAL_COPY_OVERDUE",
                    "STORE_SCRUB_MISMATCH", "BACKUP_V2_OVERDUE", "OBJECT_MISSING_IN_SOURCE", "LEDGER_CHAIN_BROKEN", "DR_KIT_OVERDUE", "AGENT_RESTARTED", "LOCAL_STORAGE_NOT_BACKED_UP" -> alertCode;
            case "BACKUP_V2_MISSED" -> "BACKUP_V2_OVERDUE";
            case "BACKUP_REFERENCE_MISSING" -> "STORE_SCRUB_MISMATCH";
            default -> alertCode.startsWith("RESTORE_") || alertCode.startsWith("REHEARSAL_") ? "RESTORE_PROBLEM"
                    : alertCode.startsWith("BACKUP_") ? "BACKUP_FAILED" : null;
        };
    }

    public List<Map<String, Object>> rules() {
        List<Map<String, Object>> out = new ArrayList<>();
        jdbc.queryForList("select code, label, hint, notify_in_app, notify_email, threshold_value, threshold_unit, threshold_min, threshold_max, updated_by, updated_at "
                + "from backup_alert_rule order by sort_order").forEach(row -> out.add(ruleMap(row)));
        return out;
    }

    private static Map<String, Object> ruleMap(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", row.get("code"));
        m.put("label", row.get("label"));
        m.put("hint", row.get("hint"));
        m.put("inApp", row.get("notify_in_app"));
        m.put("email", row.get("notify_email"));
        m.put("thresholdValue", row.get("threshold_value"));
        m.put("thresholdUnit", row.get("threshold_unit"));
        m.put("thresholdMin", row.get("threshold_min"));
        m.put("thresholdMax", row.get("threshold_max"));
        m.put("updatedBy", row.get("updated_by"));
        m.put("updatedAt", row.get("updated_at") instanceof Timestamp t ? t.toInstant().toString() : null);
        return m;
    }

    /** The limit of a rule, or {@code fallback} when the rule has none. */
    public int threshold(String code, int fallback) {
        List<Integer> v = jdbc.queryForList("select threshold_value from backup_alert_rule where code = ? and threshold_value is not null", Integer.class, code);
        return v.isEmpty() ? fallback : v.get(0);
    }

    public Map<String, Object> update(String code, boolean inApp, boolean email, Integer threshold, String by, String reason) {
        String who = text(by, "PERSON_REQUIRED", "Who is changing the rule must be known");
        String why = text(reason, "ALERT_RULE_REASON_REQUIRED", "A reason is required");
        if (why.length() > MAX_REASON) throw ExportException.invalid("ALERT_RULE_REASON_REQUIRED", "The reason is at most " + MAX_REASON + " characters");
        Map<String, Object> cur = jdbc.queryForList("select notify_in_app, notify_email, threshold_value, threshold_min, threshold_max from backup_alert_rule where code = ?", code)
                .stream().findFirst().orElseThrow(() -> ExportException.notFound("ALERT_RULE_NOT_FOUND", "There is no alert rule " + code));
        Integer oldThreshold = (Integer) cur.get("threshold_value");
        if (oldThreshold == null && threshold != null) throw ExportException.invalid("ALERT_RULE_NO_THRESHOLD", "This alert has no limit to set");
        if (oldThreshold != null) {
            if (threshold == null) throw ExportException.invalid("ALERT_RULE_THRESHOLD_REQUIRED", "This alert needs a limit");
            int min = ((Number) cur.get("threshold_min")).intValue();
            int max = ((Number) cur.get("threshold_max")).intValue();
            if (threshold < min || threshold > max) throw ExportException.invalid("ALERT_RULE_THRESHOLD_RANGE", "The limit must be between " + min + " and " + max);
        }
        boolean oldInApp = (Boolean) cur.get("notify_in_app");
        boolean oldEmail = (Boolean) cur.get("notify_email");
        if (oldInApp == inApp && oldEmail == email && java.util.Objects.equals(oldThreshold, threshold)) {
            throw ExportException.conflict("ALERT_RULE_UNCHANGED", "Nothing was changed");
        }
        jdbc.update("update backup_alert_rule set notify_in_app = ?, notify_email = ?, threshold_value = ?, updated_by = ?, updated_at = now() where code = ?",
                inApp, email, threshold, who, code);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("inApp", inApp);
        data.put("email", email);
        data.put("threshold", threshold);
        data.put("reason", why);
        ledger.append(who, "ALERT_RULE_CHANGED", code, data);
        Map<String, Object> after = new LinkedHashMap<>(rules().stream().filter(r -> code.equals(r.get("code"))).findFirst().orElseThrow());
        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("inApp", oldInApp);
        previous.put("email", oldEmail);
        previous.put("threshold", oldThreshold);
        after.put("previous", previous);
        return after;
    }

    /**
     * The alerts still to be told, with the channels their rule allows, and the people to tell. An alert whose rule has no channel on, or
     * that has nobody to be told, is marked done here: it stays in the list of alerts either way.
     */
    public Map<String, Object> pendingDelivery(int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        List<String> recipients = jdbc.queryForList("select username from backup_alert_recipient where active order by username", String.class);
        Map<String, boolean[]> channels = new LinkedHashMap<>();
        jdbc.queryForList("select code, notify_in_app, notify_email from backup_alert_rule").forEach(r ->
                channels.put((String) r.get("code"), new boolean[] {(Boolean) r.get("notify_in_app"), (Boolean) r.get("notify_email")}));
        List<Map<String, Object>> send = new ArrayList<>();
        List<UUID> skip = new ArrayList<>();
        jdbc.queryForList("select id, at, severity, code, detail, ref from backup_alert where delivered_at is null order by at limit ?", size).forEach(row -> {
            String rule = ruleOf((String) row.get("code"));
            boolean[] c = rule == null ? new boolean[] {true, false} : channels.getOrDefault(rule, new boolean[] {true, false});
            UUID id = (UUID) row.get("id");
            if (recipients.isEmpty() || (!c[0] && !c[1])) {
                skip.add(id);
                return;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id.toString());
            m.put("at", row.get("at") instanceof Timestamp t ? t.toInstant().toString() : null);
            m.put("severity", row.get("severity"));
            m.put("code", row.get("code"));
            m.put("detail", row.get("detail"));
            m.put("ref", row.get("ref"));
            m.put("inApp", c[0]);
            m.put("email", c[1]);
            send.add(m);
        });
        markDelivered(skip);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("alerts", send);
        out.put("recipients", recipients);
        return out;
    }

    public int markDelivered(List<UUID> ids) {
        int n = 0;
        for (UUID id : ids) n += jdbc.update("update backup_alert set delivered_at = now() where id = ? and delivered_at is null", id);
        return n;
    }

    private static String text(String value, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty()) throw ExportException.invalid(code, message);
        return t;
    }
}
