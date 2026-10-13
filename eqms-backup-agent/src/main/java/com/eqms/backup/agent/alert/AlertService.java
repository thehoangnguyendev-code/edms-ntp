package com.eqms.backup.agent.alert;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Backup alerts (SDS 15.1): the list of alerts with their state, acknowledging an alert (who saw it and when), and the people who
 * receive them. Nothing is deleted. Each change is written to the ledger.
 */
@Service
public class AlertService {

    static final Set<String> SEVERITIES = Set.of("INFO", "WARNING", "HIGH", "CRITICAL");
    static final Set<String> STATES = Set.of("OPEN", "ACKNOWLEDGED", "ALL");

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;

    public AlertService(JdbcTemplate jdbc, LedgerService ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    public Map<String, Object> page(String state, String severity, String search, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        String s = state == null || state.isBlank() ? "OPEN" : state.trim().toUpperCase(Locale.ROOT);
        if (!STATES.contains(s)) throw ExportException.invalid("ALERT_STATE", "The state must be one of " + STATES);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!s.equals("ALL")) where.append(s.equals("OPEN") ? " and a.acknowledged_at is null" : " and a.acknowledged_at is not null");
        if (severity != null && !severity.isBlank()) {
            String sev = severity.trim().toUpperCase(Locale.ROOT);
            if (!SEVERITIES.contains(sev)) throw ExportException.invalid("ALERT_SEVERITY", "The severity must be one of " + SEVERITIES);
            where.append(" and a.severity = ?");
            args.add(sev);
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(a.code) like ? or lower(coalesce(a.detail,'')) like ? or lower(coalesce(a.ref,'')) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 3; i++) args.add(like);
        }
        Long total = jdbc.queryForObject("select count(*) from backup_alert a" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select a.id, a.at, a.severity, a.code, a.detail, a.ref, a.acknowledged_at, a.acknowledged_by "
                + "from backup_alert a" + where + " order by a.at desc, a.id desc limit ? offset ?", pageArgs.toArray()).stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", String.valueOf(row.get("id")));
            m.put("at", instant(row.get("at")));
            m.put("severity", row.get("severity"));
            m.put("code", row.get("code"));
            m.put("detail", row.get("detail"));
            m.put("ref", row.get("ref"));
            m.put("acknowledgedAt", instant(row.get("acknowledged_at")));
            m.put("acknowledgedBy", row.get("acknowledged_by"));
            return m;
        }).toList();
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

    /** Records that a person has seen the alert. An alert can be acknowledged once; the first acknowledgement stays. */
    public Map<String, Object> acknowledge(String id, String by, String comment) {
        String who = person(by);
        java.util.UUID alertId = uuid(id);
        int changed = jdbc.update("update backup_alert set acknowledged_at = now(), acknowledged_by = ? where id = ? and acknowledged_at is null", who, alertId);
        if (changed != 1) {
            Integer exists = jdbc.queryForObject("select count(*) from backup_alert where id = ?", Integer.class, alertId);
            if (exists == null || exists == 0) throw ExportException.notFound("ALERT_NOT_FOUND", "There is no alert " + id);
            throw ExportException.conflict("ALERT_ALREADY_ACKNOWLEDGED", "This alert was already acknowledged");
        }
        String note = comment == null ? "" : comment.trim();
        ledger.append(who, "ALERT_ACKNOWLEDGED", id, Map.of("comment", note));
        return Map.of("id", id, "acknowledgedBy", who);
    }

    public List<Map<String, Object>> recipients() {
        return jdbc.queryForList("select username, added_by, added_at from backup_alert_recipient where active order by username").stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("username", row.get("username"));
            m.put("addedBy", row.get("added_by"));
            m.put("addedAt", instant(row.get("added_at")));
            return m;
        }).toList();
    }

    /** Adds a recipient, or makes a removed one active again. The backend has checked that the account exists and is active. */
    public Map<String, Object> addRecipient(String username, String by) {
        String who = person(by);
        String target = person(username);
        jdbc.update("insert into backup_alert_recipient(username, active, added_by) values (?, true, ?) "
                + "on conflict (username) do update set active = true, added_by = excluded.added_by, added_at = now(), removed_by = null, removed_at = null",
                target, who);
        ledger.append(who, "ALERT_RECIPIENT_ADDED", null, Map.of("username", target));
        return Map.of("username", target);
    }

    public Map<String, Object> removeRecipient(String username, String by) {
        String who = person(by);
        String target = person(username);
        int changed = jdbc.update("update backup_alert_recipient set active = false, removed_by = ?, removed_at = now() where username = ? and active",
                who, target);
        if (changed != 1) throw ExportException.notFound("ALERT_RECIPIENT_NOT_FOUND", "There is no active recipient " + target);
        ledger.append(who, "ALERT_RECIPIENT_REMOVED", null, Map.of("username", target));
        return Map.of("username", target);
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    private static java.util.UUID uuid(String id) {
        try {
            return java.util.UUID.fromString(id);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ExportException.notFound("ALERT_NOT_FOUND", "There is no alert " + id);
        }
    }

    private static String person(String by) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is doing this must be known");
        return by.trim();
    }
}
