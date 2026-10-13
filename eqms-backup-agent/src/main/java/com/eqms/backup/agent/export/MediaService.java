package com.eqms.backup.agent.export;

import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The Offline Media Register (SDS 6.5.3 and 6.5.4). Every medium that can receive a package is a row here, every change to it is an
 * append-only event, and the steps that move a medium between people need two different people.
 */
@Service
public class MediaService {

    public static final Set<String> KINDS = Set.of("HDD", "SSD", "USB", "TAPE");
    private static final Set<String> STATUSES = Set.of("AVAILABLE", "IN_TRANSIT", "STORED_OFFSITE", "IN_READ_TEST", "QUARANTINED", "RETIRED");

    public record Registration(String label, String serialNumber, String kind, long capacityBytes, String exportDir, String expiresOn, String by) {
    }

    public record Page(List<Map<String, Object>> data, int page, int limit, long total) {
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;

    public MediaService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
    }

    // ------------------------------------------------------------------ reading

    private static final String SELECT = "select m.id, m.label, m.serial_number, m.kind, m.capacity_bytes, m.export_dir, m.status, m.holder, m.storage_location, "
            + "m.handed_over_at, m.last_read_test_at, m.last_read_test_result, m.expires_on, m.destruction_record, m.holds_legal_hold, m.registered_by, m.created_at, "
            + "(select count(*) from backup_export e where e.media_id = m.id and e.status = 'COMPLETED' and e.finished_at > coalesce("
            + "(select max(at) from media_event v where v.media_id = m.id and v.event = 'RECYCLED'), 'epoch'::timestamptz)) as package_count "
            + "from offline_media m";

    public Page page(String search, String status, String kind, String sortBy, boolean ascending, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            where.append(" and m.status = ?");
            args.add(status.trim().toUpperCase(Locale.ROOT));
        }
        if (kind != null && !kind.isBlank()) {
            where.append(" and m.kind = ?");
            args.add(kind.trim().toUpperCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(m.label) like ? or lower(m.serial_number) like ? or lower(coalesce(m.holder,'')) like ? or lower(coalesce(m.storage_location,'')) like ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            for (int i = 0; i < 4; i++) args.add(like);
        }
        String column = switch (sortBy == null ? "" : sortBy) {
            case "status" -> "m.status";
            case "kind" -> "m.kind";
            case "holder" -> "m.holder";
            case "lastReadTestAt" -> "m.last_read_test_at";
            case "expiresOn" -> "m.expires_on";
            case "createdAt" -> "m.created_at";
            default -> "m.label";
        };
        Long total = jdbc.queryForObject("select count(*) from offline_media m" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + where + " order by " + column + (ascending ? " asc" : " desc") + " nulls last, m.label asc limit ? offset ?", pageArgs.toArray())
                .stream().map(MediaService::view).toList();
        return new Page(rows, safePage, safeLimit, total == null ? 0 : total);
    }

    public Map<String, Object> get(UUID id) {
        return jdbc.queryForList(SELECT + " where m.id = ?", id).stream().findFirst().map(MediaService::view)
                .orElseThrow(() -> ExportException.notFound("MEDIA_NOT_FOUND", "There is no such medium"));
    }

    public List<Map<String, Object>> events(UUID id) {
        get(id);
        return jdbc.queryForList("select event, by_user, at, detail_json::text as detail from media_event where media_id = ? order by id desc", id).stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("event", row.get("event"));
            m.put("by", row.get("by_user"));
            m.put("at", ((Timestamp) row.get("at")).toInstant().toString());
            m.put("detail", row.get("detail"));
            return m;
        }).toList();
    }

    /** The packages on a medium that are still on it: completed, and not before the medium was last recycled. */
    public List<Map<String, Object>> packages(UUID id) {
        get(id);
        return jdbc.queryForList("select e.export_id, r.backup_number, e.finished_at, e.size_bytes, e.receipt_sha256 from backup_export e join backup_run r on r.id = e.run_id "
                + "where e.media_id = ? and e.status = 'COMPLETED' and e.finished_at > coalesce((select max(at) from media_event v where v.media_id = e.media_id and v.event = 'RECYCLED'), 'epoch'::timestamptz) "
                + "order by e.finished_at desc", id).stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("exportId", row.get("export_id"));
            m.put("backupNumber", row.get("backup_number"));
            m.put("finishedAt", ((Timestamp) row.get("finished_at")).toInstant().toString());
            m.put("sizeBytes", row.get("size_bytes"));
            m.put("receiptSha256", row.get("receipt_sha256") == null ? null : String.valueOf(row.get("receipt_sha256")).trim());
            return m;
        }).toList();
    }

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", String.valueOf(row.get("id")));
        m.put("label", row.get("label"));
        m.put("serialNumber", row.get("serial_number"));
        m.put("kind", row.get("kind"));
        m.put("capacityBytes", row.get("capacity_bytes"));
        m.put("exportDir", row.get("export_dir"));
        m.put("status", row.get("status"));
        m.put("holder", row.get("holder"));
        m.put("storageLocation", row.get("storage_location"));
        m.put("handedOverAt", instant(row.get("handed_over_at")));
        m.put("lastReadTestAt", instant(row.get("last_read_test_at")));
        m.put("lastReadTestResult", row.get("last_read_test_result"));
        m.put("expiresOn", row.get("expires_on") == null ? null : row.get("expires_on").toString());
        m.put("destructionRecord", row.get("destruction_record"));
        m.put("holdsLegalHold", row.get("holds_legal_hold"));
        m.put("registeredBy", row.get("registered_by"));
        m.put("createdAt", instant(row.get("created_at")));
        m.put("packageCount", row.get("package_count"));
        return m;
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    // ------------------------------------------------------------------ changing

    public Map<String, Object> register(Registration r) {
        String by = person(r.by());
        String label = text(r.label(), 60, "MEDIA_LABEL_REQUIRED", "A label is required (at most 60 characters)");
        String serial = text(r.serialNumber(), 120, "MEDIA_SERIAL_REQUIRED", "A serial number is required");
        String kind = r.kind() == null ? "" : r.kind().trim().toUpperCase(Locale.ROOT);
        if (!KINDS.contains(kind)) throw ExportException.invalid("MEDIA_KIND", "The kind of medium must be one of " + String.join(", ", KINDS));
        if (r.capacityBytes() <= 0) throw ExportException.invalid("MEDIA_CAPACITY", "The capacity must be greater than zero");
        String dir = r.exportDir() == null ? "" : r.exportDir().trim();
        if (!dir.matches("[A-Za-z0-9._-]{1,64}") || dir.equals(".") || dir.equals("..")) {
            throw ExportException.invalid("MEDIA_EXPORT_DIR", "The folder name may only use letters, digits, dot, dash and underscore");
        }
        LocalDate expires = null;
        if (r.expiresOn() != null && !r.expiresOn().isBlank()) {
            try {
                expires = LocalDate.parse(r.expiresOn().trim());
            } catch (DateTimeParseException e) {
                throw ExportException.invalid("MEDIA_EXPIRY", "The expiry date must be yyyy-MM-dd");
            }
        }
        LocalDate expiry = expires;
        try {
            UUID id = tx.execute(status -> {
                UUID created = jdbc.queryForObject("insert into offline_media(label, serial_number, kind, capacity_bytes, export_dir, expires_on, registered_by) values (?,?,?,?,?,?,?) returning id",
                        UUID.class, label, serial, kind, r.capacityBytes(), dir, expiry == null ? null : Date.valueOf(expiry), by);
                event(created, "REGISTERED", by, Map.of("label", label, "serial", serial, "kind", kind));
                return created;
            });
            ledger.append(by, "MEDIA_REGISTERED", label, Map.of("kind", kind, "serial", serial));
            return get(id);
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("MEDIA_DUPLICATE", "A medium with this label or folder already exists");
        }
    }

    /** The deliverer records who will hold the medium and where. It stays in transit until a different person receives it. */
    public Map<String, Object> handover(UUID id, String holder, String location, String by) {
        String actor = person(by);
        String who = text(holder, 120, "MEDIA_HOLDER_REQUIRED", "Who will hold the medium must be given");
        String where = text(location, 200, "MEDIA_LOCATION_REQUIRED", "Where the medium will be kept must be given");
        Map<String, Object> media = get(id);
        requireStatus(media, "IN_TRANSIT");
        tx.executeWithoutResult(s -> event(id, "HANDED_OVER", actor, Map.of("holder", who, "location", where)));
        ledger.append(actor, "MEDIA_HANDED_OVER", String.valueOf(media.get("label")), Map.of("holder", who, "location", where));
        return get(id);
    }

    public Map<String, Object> receive(UUID id, String by) {
        String actor = person(by);
        Map<String, Object> media = get(id);
        requireStatus(media, "IN_TRANSIT");
        List<Map<String, Object>> last = jdbc.queryForList("select by_user, detail_json::text as detail from media_event where media_id = ? and event in ('HANDED_OVER','EXPORTED') order by id desc limit 1", id);
        if (last.isEmpty() || !"HANDED_OVER".equals(eventName(id))) {
            throw ExportException.conflict("MEDIA_NOT_HANDED_OVER", "The deliverer has not recorded the handover yet");
        }
        String deliverer = (String) last.get(0).get("by_user");
        if (deliverer.equalsIgnoreCase(actor)) {
            throw new ExportException(ExportException.Kind.SEPARATION, "MEDIA_SAME_PERSON", "The person who handed the medium over cannot be the one who confirms receiving it");
        }
        Map<String, Object> detail = json(String.valueOf(last.get(0).get("detail")));
        tx.executeWithoutResult(s -> {
            jdbc.update("update offline_media set status = 'STORED_OFFSITE', holder = ?, storage_location = ?, handed_over_at = now() where id = ?", detail.get("holder"), detail.get("location"), id);
            event(id, "RECEIVED", actor, Map.of("holder", detail.get("holder"), "location", detail.get("location"), "deliveredBy", deliverer));
        });
        ledger.append(actor, "MEDIA_RECEIVED", String.valueOf(media.get("label")), Map.of("holder", detail.get("holder"), "deliveredBy", deliverer));
        return get(id);
    }

    public Map<String, Object> readTest(UUID id, String result, String detail, String by) {
        String actor = person(by);
        String outcome = result == null ? "" : result.trim().toUpperCase(Locale.ROOT);
        if (!outcome.equals("PASSED") && !outcome.equals("FAILED")) throw ExportException.invalid("MEDIA_READ_TEST_RESULT", "The result must be PASSED or FAILED");
        String note = text(detail, 500, "MEDIA_READ_TEST_DETAIL", "Say what was checked (decrypted, verify-chain run, by whom)");
        Map<String, Object> media = get(id);
        String status = (String) media.get("status");
        if (!status.equals("STORED_OFFSITE") && !status.equals("IN_TRANSIT") && !status.equals("QUARANTINED")) {
            throw ExportException.conflict("MEDIA_STATE", "A read test is recorded for a medium that holds packages; this one is " + status);
        }
        String next = outcome.equals("FAILED") ? "QUARANTINED" : (status.equals("QUARANTINED") ? "STORED_OFFSITE" : status);
        tx.executeWithoutResult(s -> {
            jdbc.update("update offline_media set status = ?, last_read_test_at = now(), last_read_test_result = ? where id = ?", next, outcome, id);
            event(id, "READ_TESTED", actor, Map.of("result", outcome, "detail", note));
        });
        ledger.append(actor, "MEDIA_READ_TESTED", String.valueOf(media.get("label")), Map.of("result", outcome));
        if (outcome.equals("FAILED")) {
            jdbc.update("insert into backup_alert(severity, code, detail, ref) values ('HIGH', 'MEDIA_READ_FAILED', ?, ?)",
                    "Medium " + media.get("label") + " failed its read test and is quarantined; its packages must be exported again", String.valueOf(media.get("label")));
        }
        return get(id);
    }

    /** The medium is wiped and goes back into use; the packages it held no longer count. Refused while it holds legal-hold data. */
    public Map<String, Object> recycle(UUID id, boolean wipeConfirmed, String reason, String by) {
        String actor = person(by);
        String why = text(reason, 500, "MEDIA_REASON_REQUIRED", "A reason is required");
        if (!wipeConfirmed) throw ExportException.invalid("MEDIA_WIPE_UNCONFIRMED", "Confirm that the medium was securely wiped before it is used again");
        Map<String, Object> media = get(id);
        String status = (String) media.get("status");
        if (!status.equals("STORED_OFFSITE") && !status.equals("QUARANTINED")) throw ExportException.conflict("MEDIA_STATE", "Only a stored or quarantined medium can be recycled; this one is " + status);
        if (Boolean.TRUE.equals(media.get("holdsLegalHold"))) throw ExportException.conflict("MEDIA_LEGAL_HOLD", "The medium holds data under legal hold and cannot be reused");
        tx.executeWithoutResult(s -> {
            jdbc.update("update offline_media set status = 'AVAILABLE', holder = null, storage_location = null where id = ?", id);
            event(id, "RECYCLED", actor, Map.of("reason", why, "wipeConfirmed", true));
        });
        ledger.append(actor, "MEDIA_RECYCLED", String.valueOf(media.get("label")), Map.of("reason", why));
        return get(id);
    }

    public Map<String, Object> retire(UUID id, String destructionRecord, String by) {
        String actor = person(by);
        String record = text(destructionRecord, 1000, "MEDIA_DESTRUCTION_RECORD", "A destruction record is required to retire a medium");
        Map<String, Object> media = get(id);
        String status = (String) media.get("status");
        if (status.equals("RETIRED")) throw ExportException.conflict("MEDIA_STATE", "The medium is already retired");
        if (status.equals("IN_TRANSIT")) throw ExportException.conflict("MEDIA_STATE", "A medium in transit cannot be retired");
        if (Boolean.TRUE.equals(media.get("holdsLegalHold"))) throw ExportException.conflict("MEDIA_LEGAL_HOLD", "The medium holds data under legal hold and cannot be destroyed");
        tx.executeWithoutResult(s -> {
            jdbc.update("update offline_media set status = 'RETIRED', destruction_record = ? where id = ?", record, id);
            event(id, "RETIRED", actor, Map.of("destructionRecord", record));
        });
        ledger.append(actor, "MEDIA_RETIRED", String.valueOf(media.get("label")), Map.of());
        return get(id);
    }

    /** Called by the export job once a package is on the medium and read back. */
    void markExported(UUID mediaId, String exportId, String by, String receiptSha256) {
        jdbc.update("update offline_media set status = 'IN_TRANSIT' where id = ?", mediaId);
        event(mediaId, "EXPORTED", by, Map.of("exportId", exportId, "receiptSha256", receiptSha256));
    }

    // ------------------------------------------------------------------ helpers

    private String eventName(UUID id) {
        return jdbc.queryForObject("select event from media_event where media_id = ? and event in ('HANDED_OVER','EXPORTED') order by id desc limit 1", String.class, id);
    }

    private void event(UUID id, String event, String by, Map<String, ?> detail) {
        jdbc.update("insert into media_event(media_id, event, by_user, detail_json) values (?,?,?,?::jsonb)", id, event, by, CanonicalJson.of(detail));
    }

    private static void requireStatus(Map<String, Object> media, String expected) {
        if (!expected.equals(media.get("status"))) {
            throw ExportException.conflict("MEDIA_STATE", "The medium is " + media.get("status") + ", not " + expected);
        }
    }

    private static String person(String by) {
        if (by == null || by.isBlank()) throw ExportException.invalid("PERSON_REQUIRED", "Who is doing this must be known");
        return by.trim();
    }

    private static String text(String value, int max, String code, String message) {
        String t = value == null ? "" : value.trim();
        if (t.isEmpty() || t.length() > max) throw ExportException.invalid(code, message);
        return t;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> json(String text) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(text, Map.class);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    static boolean knownStatus(String s) {
        return STATUSES.contains(s);
    }

    static Instant now() {
        return Instant.now();
    }
}
