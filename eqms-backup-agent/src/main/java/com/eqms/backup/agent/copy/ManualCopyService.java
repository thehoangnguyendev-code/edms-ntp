package com.eqms.backup.agent.copy;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The copy a person makes by hand (the third copy of the 3-2-1 rule). The Backup Agent cannot see that copy; it keeps what a person
 * records about it (the day, the place, who made it, the newest backup it holds) and says when the next one is due according to the
 * active policy. A record is never edited or removed, and a record is never made by the system itself.
 */
@Service
public class ManualCopyService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final LedgerService ledger;

    public ManualCopyService(JdbcTemplate jdbc, LedgerService ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    /** What the active policy declares about the manual copy: null when it declares none. */
    public record Declared(String description, int everyDays) {
    }

    public Declared declared() {
        List<String> targets = jdbc.queryForList("select targets_json::text from backup_policy where status = 'ACTIVE'", String.class);
        if (targets.isEmpty()) return null;
        try {
            JsonNode m = JSON.readTree(targets.get(0)).path("manualCopy");
            if (!m.path("declared").asBoolean(false)) return null;
            return new Declared(m.path("description").asText(""), m.path("everyDays").asInt(0));
        } catch (java.io.IOException e) {
            return null;
        }
    }

    /** The last copy a person recorded, the day the next one is due, and whether it is overdue. */
    public Map<String, Object> status(LocalDate today) {
        Declared declared = declared();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("declared", declared != null);
        out.put("description", declared == null ? null : declared.description());
        out.put("everyDays", declared == null ? null : declared.everyDays());
        List<Map<String, Object>> last = jdbc.queryForList("select copied_on, backup_number, place, made_by, recorded_by, recorded_at from manual_copy_record order by copied_on desc, recorded_at desc limit 1");
        if (last.isEmpty()) {
            out.put("lastCopiedOn", null);
            out.put("nextDueOn", null);
            out.put("state", declared == null ? "NOT_DECLARED" : "NEVER_RECORDED");
            return out;
        }
        Map<String, Object> row = last.get(0);
        LocalDate copied = ((Date) row.get("copied_on")).toLocalDate();
        out.put("lastCopiedOn", copied.toString());
        out.put("lastBackupNumber", row.get("backup_number"));
        out.put("lastPlace", row.get("place"));
        out.put("lastMadeBy", row.get("made_by"));
        if (declared == null || declared.everyDays() < 1) {
            out.put("nextDueOn", null);
            out.put("state", "NOT_DECLARED");
        } else {
            LocalDate due = copied.plusDays(declared.everyDays());
            out.put("nextDueOn", due.toString());
            out.put("state", today.isAfter(due) ? "OVERDUE" : "ON_TIME");
        }
        return out;
    }

    public Map<String, Object> record(LocalDate copiedOn, String backupNumber, String place, String madeBy, String note, String by, ZoneId zone) {
        String who = need(by, "PERSON_REQUIRED", "Who is recording the copy must be known");
        if (copiedOn == null) throw ExportException.invalid("MANUAL_COPY_DATE_REQUIRED", "The day the copy was made is required");
        if (copiedOn.isAfter(LocalDate.now(zone))) throw ExportException.invalid("MANUAL_COPY_DATE_FUTURE", "A copy cannot be recorded for a day in the future");
        String where = need(place, "MANUAL_COPY_PLACE_REQUIRED", "Say where the copy is kept");
        String maker = need(madeBy, "MANUAL_COPY_PERSON_REQUIRED", "Say who made the copy");
        if (where.length() > 200 || maker.length() > 120) throw ExportException.invalid("MANUAL_COPY_TOO_LONG", "The place is at most 200 characters and the name at most 120");
        String number = backupNumber == null || backupNumber.isBlank() ? null : backupNumber.trim();
        if (number != null) {
            Integer found = jdbc.queryForObject("select count(*) from backup_run where backup_number = ? and status = 'COMPLETED'", Integer.class, number);
            if (found == null || found == 0) throw ExportException.notFound("BACKUP_NOT_FOUND", "There is no completed backup " + number);
        }
        String text = note == null || note.isBlank() ? null : note.trim();
        if (text != null && text.length() > 1000) throw ExportException.invalid("MANUAL_COPY_TOO_LONG", "The note is at most 1000 characters");
        UUID id = jdbc.queryForObject("insert into manual_copy_record(copied_on, backup_number, place, made_by, note, recorded_by) values (?,?,?,?,?,?) returning id",
                UUID.class, Date.valueOf(copiedOn), number, where, maker, text, who);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("copiedOn", copiedOn.toString());
        data.put("backupNumber", number);
        data.put("place", where);
        data.put("madeBy", maker);
        ledger.append(who, "MANUAL_COPY_RECORDED", number, data);
        return Map.of("id", id.toString(), "copiedOn", copiedOn.toString());
    }

    public Map<String, Object> page(int page, int limit) {
        int size = Math.min(Math.max(limit, 1), 100);
        int no = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from manual_copy_record", Long.class);
        List<Map<String, Object>> rows = new ArrayList<>();
        jdbc.queryForList("select id, copied_on, backup_number, place, made_by, note, recorded_by, recorded_at from manual_copy_record "
                + "order by copied_on desc, recorded_at desc limit ? offset ?", size, (no - 1) * size).forEach(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", String.valueOf(row.get("id")));
            m.put("copiedOn", ((Date) row.get("copied_on")).toLocalDate().toString());
            m.put("backupNumber", row.get("backup_number"));
            m.put("place", row.get("place"));
            m.put("madeBy", row.get("made_by"));
            m.put("note", row.get("note"));
            m.put("recordedBy", row.get("recorded_by"));
            m.put("recordedAt", row.get("recorded_at") instanceof Timestamp t ? t.toInstant().toString() : null);
            rows.add(m);
        });
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

    private static String need(String value, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty()) throw ExportException.invalid(code, message);
        return t;
    }
}
