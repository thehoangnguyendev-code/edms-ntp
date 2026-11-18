package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.util.DateTimeFormatUtils;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * The numbers of the records that had only a name (AUDIT-OBJECT-REGISTRY-2026-11-17): Scheduled Report Number, Audit Trail Campaign Number, Access Review
 * Campaign Number, Object Access Rule Number, Backup Alert Number, Announcement Number, Recall Batch Number. The format of each kind is set in System Administration > Object Numbering:
 * a prefix, a separator, the year or not, and the number of digits. A number is given once, from a counter that only goes up (kept per kind and per year, in the
 * same transaction as the record, so two people creating at once never get the same number), and it never changes: a change of format applies to the records
 * made after it. A number that was given and whose record was not saved is not given again; the gap is the price of never repeating a number.
 */
@Service
public class ObjectNumberService {
    public static final String SCHEDULED_REPORT = "SCHEDULED_REPORT";
    public static final String AUDIT_TRAIL_CAMPAIGN = "AUDIT_TRAIL_CAMPAIGN";
    public static final String ACCESS_REVIEW_CAMPAIGN = "ACCESS_REVIEW_CAMPAIGN";
    public static final String OBJECT_ACCESS_RULE = "OBJECT_ACCESS_RULE";
    public static final String BACKUP_ALERT = "BACKUP_ALERT";
    public static final String ANNOUNCEMENT = "ANNOUNCEMENT";
    public static final String RECALL_BATCH = "RECALL_BATCH";

    /** The separator is typed by the administrator: up to 3 characters, none of them a space, a control character or one that could break a code (< > " ' \ %). Empty is allowed (ANN20260015). */
    private static final Pattern SEPARATOR = Pattern.compile("[^\\s\\p{Cntrl}<>\"'\\\\%]{0,3}");
    private static final Pattern PREFIX = Pattern.compile("[A-Z][A-Z0-9]{1,9}");
    private static final int MAX_REASON = 1000;

    /** A format as an administrator sets it. */
    public record Format(String kind, String moduleName, String label, String prefix, String separator, boolean includeYear, int digits, int version) {
    }

    public record FormatWrite(String prefix, String separator, Boolean includeYear, Integer digits, Integer version, String reason) {
    }

    private final JdbcTemplate jdbc;
    private final EffectivePermissionService permissions;
    private final AuditTrailService audit;

    public ObjectNumberService(JdbcTemplate jdbc, EffectivePermissionService permissions, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.audit = audit;
    }

    /** The number a format makes for a counter value, e.g. SRP-2026-00001. Pure: the screen's example and the real number come from here. */
    public static String compose(Format format, int year, long value) {
        String sequence = String.format("%0" + format.digits() + "d", value);
        return format.includeYear()
                ? format.prefix() + format.separator() + year + format.separator() + sequence
                : format.prefix() + format.separator() + sequence;
    }

    public static int currentYear() {
        return LocalDate.now(DateTimeFormatUtils.ZONE).getYear();
    }

    public Format format(String kind) {
        List<Format> rows = jdbc.query("select kind, module_name, label, prefix, separator, include_year, digits, version from object_number_formats where kind = ?",
                (rs, n) -> new Format(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getBoolean(6), rs.getInt(7), rs.getInt(8)), kind);
        if (rows.isEmpty()) throw new IllegalStateException("OBJECT_NUMBER_KIND_UNKNOWN: " + kind);
        return rows.getFirst();
    }

    /**
     * Gives the next number of a kind for a record made in the given year (the year of the record's creation, normally the current one). Call it in the
     * transaction that saves the record. The counter row is locked by the upsert, which is what keeps two creators from getting the same value.
     */
    @Transactional
    public String allocate(String kind, int year) {
        Format format = format(kind);
        String period = format.includeYear() ? String.valueOf(year) : "";
        Long value = jdbc.queryForObject(
                "insert into object_number_counters(kind, period, last_value) values (?, ?, 1) "
                        + "on conflict (kind, period) do update set last_value = object_number_counters.last_value + 1 returning last_value", Long.class, kind, period);
        return compose(format, year, Objects.requireNonNull(value));
    }

    public String allocate(String kind) {
        return allocate(kind, currentYear());
    }

    /** Every format with an example, for the administration screen. */
    public List<Map<String, Object>> list(UserAccount actor) {
        require(actor, "settings.object_numbering.view", "settings.object_numbering.manage");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Format f : jdbc.query("select kind, module_name, label, prefix, separator, include_year, digits, version from object_number_formats order by module_name, label",
                (rs, n) -> new Format(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getBoolean(6), rs.getInt(7), rs.getInt(8)))) {
            out.add(toMap(f));
        }
        return out;
    }

    private Map<String, Object> toMap(Format f) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("kind", f.kind());
        row.put("module", f.moduleName());
        row.put("label", f.label());
        row.put("prefix", f.prefix());
        row.put("separator", f.separator());
        row.put("includeYear", f.includeYear());
        row.put("digits", f.digits());
        row.put("version", f.version());
        row.put("example", compose(f, currentYear(), 1));
        List<Map<String, Object>> last = jdbc.queryForList("select coalesce(max(last_value),0) as last from object_number_counters where kind = ?", f.kind());
        row.put("lastValue", ((Number) last.getFirst().get("last")).longValue());
        return row;
    }

    /** The example of a format as it would be written, before it is saved. */
    public Map<String, Object> preview(UserAccount actor, String kind, FormatWrite request) {
        require(actor, "settings.object_numbering.view", "settings.object_numbering.manage");
        Format current = format(kind);
        Format candidate = candidate(current, request);
        return Map.of("example", compose(candidate, currentYear(), 1), "next", compose(candidate, currentYear(), nextValue(candidate)));
    }

    private long nextValue(Format f) {
        List<Map<String, Object>> rows = jdbc.queryForList("select last_value from object_number_counters where kind = ? and period = ?", f.kind(), f.includeYear() ? String.valueOf(currentYear()) : "");
        return rows.isEmpty() ? 1 : ((Number) rows.getFirst().get("last_value")).longValue() + 1;
    }

    /** Changes a format. The version must be the one the administrator read. A number already given is not touched. */
    @Transactional
    public Map<String, Object> update(UserAccount actor, String kind, FormatWrite request) {
        // whoever may change the system configuration may change the numbering, as for the appearance of reports; the permission of its own is for a narrower role
        require(actor, "settings.object_numbering.manage");
        if (request == null || request.reason() == null || request.reason().isBlank() || request.reason().length() > MAX_REASON) throw new IllegalArgumentException("OBJECT_NUMBER_REASON_REQUIRED");
        List<Map<String, Object>> locked = jdbc.queryForList("select version from object_number_formats where kind = ? for update", kind);
        if (locked.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "OBJECT_NUMBER_KIND_NOT_FOUND");
        if (request.version() == null || ((Number) locked.getFirst().get("version")).intValue() != request.version()) throw new ResponseStatusException(HttpStatus.CONFLICT, "OBJECT_NUMBER_FORMAT_VERSION_CHANGED");
        Format before = format(kind);
        Format after = candidate(before, request);
        jdbc.update("update object_number_formats set prefix=?, separator=?, include_year=?, digits=?, version=version+1, updated_at=now(), updated_by=? where kind=?",
                after.prefix(), after.separator(), after.includeYear(), after.digits(), actor.getId(), kind);
        audit.logAs(actor, "OBJECT_NUMBER_FORMAT", before.label(), UUID.nameUUIDFromBytes(("OBJECT_NUMBER_FORMAT:" + kind).getBytes(StandardCharsets.UTF_8)),
                "OBJECT_NUMBER_FORMAT_UPDATED", compose(before, currentYear(), 1), compose(after, currentYear(), 1), request.reason().trim(),
                com.eqms.util.AuditChanges.with("Reason", request.reason(), com.eqms.util.AuditChanges.of("Prefix",before.prefix(),after.prefix()), com.eqms.util.AuditChanges.of("Separator",before.separator(),after.separator()), com.eqms.util.AuditChanges.of("Include Year",before.includeYear() ? "Yes" : "No",after.includeYear() ? "Yes" : "No"), com.eqms.util.AuditChanges.of("Digits",before.digits(),after.digits())));
        return toMap(format(kind));
    }

    private Format candidate(Format current, FormatWrite request) {
        if (request == null) throw new IllegalArgumentException("OBJECT_NUMBER_FORMAT_INVALID");
        String prefix = request.prefix() == null ? current.prefix() : request.prefix().trim().toUpperCase(java.util.Locale.ROOT);
        String separator = request.separator() == null ? current.separator() : request.separator();
        boolean includeYear = request.includeYear() == null ? current.includeYear() : request.includeYear();
        int digits = request.digits() == null ? current.digits() : request.digits();
        if (!PREFIX.matcher(prefix).matches()) throw new IllegalArgumentException("OBJECT_NUMBER_PREFIX_INVALID");
        if (!SEPARATOR.matcher(separator).matches()) throw new IllegalArgumentException("OBJECT_NUMBER_SEPARATOR_INVALID");
        if (digits < 3 || digits > 10) throw new IllegalArgumentException("OBJECT_NUMBER_DIGITS_INVALID");
        return new Format(current.kind(), current.moduleName(), current.label(), prefix, separator, includeYear, digits, current.version());
    }

    /**
     * Numbers the records of one table that have no number yet, oldest first, each in the year it was created (D6). Idempotent: a record that has a number is
     * left alone. Returns how many were numbered. The caller writes the audit entry.
     */
    @Transactional
    public int backfill(String kind, String table, String numberColumn, String createdColumn) {
        if (!table.matches("[a-z_]+") || !numberColumn.matches("[a-z_]+") || !createdColumn.matches("[a-z_]+")) throw new IllegalArgumentException("OBJECT_NUMBER_BACKFILL_NAME");
        List<Map<String, Object>> rows = jdbc.queryForList("select id, extract(year from " + createdColumn + " at time zone ?)::int as y from " + table
                + " where " + numberColumn + " is null order by " + createdColumn + ", id for update", DateTimeFormatUtils.ZONE_ID);
        for (Map<String, Object> row : rows) {
            String number = allocate(kind, ((Number) row.get("y")).intValue());
            jdbc.update("update " + table + " set " + numberColumn + " = ? where id = ?", number, row.get("id"));
        }
        return rows.size();
    }

    /** The number of a backup alert, given the first time this system sees the alert; the same alert always has the same number. */
    @Transactional
    public String backupAlertNumber(String alertId, int year) {
        List<String> existing = jdbc.queryForList("select alert_number from backup_alert_numbers where alert_id = ?", String.class, alertId);
        if (!existing.isEmpty()) return existing.getFirst();
        // two requests may see the same new alert at once: the first insert wins and the other reads it
        String number = allocate(BACKUP_ALERT, year);
        int inserted = jdbc.update("insert into backup_alert_numbers(alert_id, alert_number) values (?, ?) on conflict (alert_id) do nothing", alertId, number);
        if (inserted == 1) return number;
        return jdbc.queryForObject("select alert_number from backup_alert_numbers where alert_id = ?", String.class, alertId);
    }

    /** The identifiers of the backup alerts whose number contains the text (a person searching the list by number). */
    public List<String> backupAlertIdsByNumber(String term) {
        if (term == null || term.isBlank()) return List.of();
        String like = "%" + term.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.queryForList("select alert_id from backup_alert_numbers where alert_number ilike ? order by alert_number limit 100", String.class, like);
    }

    private void require(UserAccount actor, String... codes) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("OBJECT_NUMBER_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        for (String code : codes) if (actual.contains(code)) return;
        throw new SecurityException("OBJECT_NUMBER_SCOPE_DENIED");
    }
}
