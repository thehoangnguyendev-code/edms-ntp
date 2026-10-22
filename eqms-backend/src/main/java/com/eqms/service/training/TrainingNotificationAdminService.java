package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
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
 * Administration of the notices of Training Management: the searchable log of every notice sent, not sent or failed, and a manual
 * run of the reminders. Both need {@code training.admin.manage}; a manual run is recorded in the Audit Trail with what it did.
 */
@Service
public class TrainingNotificationAdminService {
    static final String PERMISSION = "training.admin.manage";
    private static final UUID AUDIT_ID = UUID.nameUUIDFromBytes("TRAINING_NOTIFICATIONS".getBytes(StandardCharsets.UTF_8));
    private static final Set<String> STATUSES = Set.of("SENT", "FAILED", "SKIPPED");
    private static final Set<String> CHANNELS = Set.of("IN_APP", "EMAIL");
    /** The events the reminder run produces; they are what a manual run is measured by. */
    static final List<String> REMINDER_EVENTS = List.of("TRAINING_DUE_SOON", "TRAINING_OVERDUE", "TRAINING_STEP_WAITING", "TRAINING_QA_LIST_TODAY", "TRAINING_QA_LIST_LATE");

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingReminderScheduler reminders;
    private final AuditTrailService audit;

    public TrainingNotificationAdminService(JdbcTemplate jdbc, TrainingAccess access, TrainingReminderScheduler reminders, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.reminders = reminders;
        this.audit = audit;
    }

    /** Filters of the log. Unknown status or channel values are ignored rather than turned into SQL; a malformed date is refused. */
    public record LogQuery(String search, String status, String channel, String from, String to, String sortBy, String sortDirection, int page, int limit) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> log(UserAccount actor, LogQuery query) {
        access.require(actor, PERMISSION);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (query.search() != null && !query.search().isBlank()) {
            String like = "%" + escape(query.search().trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (lower(l.title) like ? escape '\\' or lower(l.event_code) like ? escape '\\' or lower(u.full_name) like ? escape '\\')");
            args.add(like);
            args.add(like);
            args.add(like);
        }
        if (query.channel() != null && CHANNELS.contains(query.channel())) {
            where.append(" and l.channel = ?");
            args.add(query.channel());
        }
        LocalDate from = parseDate(query.from());
        LocalDate to = parseDate(query.to());
        if (from != null) {
            where.append(" and l.created_at >= ?");
            args.add(java.sql.Timestamp.from(from.atStartOfDay(TrainingNumberService.ZONE).toInstant()));
        }
        if (to != null) {
            where.append(" and l.created_at < ?");
            args.add(java.sql.Timestamp.from(to.plusDays(1).atStartOfDay(TrainingNumberService.ZONE).toInstant()));
        }
        String source = " from training_notification_log l join app_users u on u.id = l.recipient_user_id";

        // The totals by outcome ignore the status filter, so the page can show how many of each there are within the other filters.
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("SENT", 0L);
        summary.put("FAILED", 0L);
        summary.put("SKIPPED", 0L);
        for (Map<String, Object> row : jdbc.queryForList("select l.status, count(*) as total" + source + where + " group by l.status", args.toArray())) {
            summary.put((String) row.get("status"), ((Number) row.get("total")).longValue());
        }

        List<Object> pageArgs = new ArrayList<>(args);
        if (query.status() != null && STATUSES.contains(query.status())) {
            where.append(" and l.status = ?");
            pageArgs.add(query.status());
        }
        int limit = Math.min(Math.max(query.limit(), 1), 100);
        int page = Math.max(query.page(), 1);
        Long total = jdbc.queryForObject("select count(*)" + source + where, Long.class, pageArgs.toArray());
        pageArgs.add(limit);
        pageArgs.add((page - 1) * limit);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select l.id, l.event_code, l.channel, l.status, l.reason_code, l.object_type, l.object_id, l.title, l.created_at, u.full_name as recipient_name"
                        + source + where + " order by " + sortColumn(query.sortBy()) + " " + ("asc".equalsIgnoreCase(query.sortDirection()) ? "asc" : "desc") + ", l.id limit ? offset ?",
                pageArgs.toArray());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", page, "limit", limit, "total", count, "totalPages", Math.max(1, (count + limit - 1) / limit)));
        result.put("summary", summary);
        return result;
    }

    /**
     * Runs every reminder for today. The reminders carry a key per day or week, so a second run the same day sends nothing new; the
     * result says how many notices this run really sent, skipped and failed, read from the log rather than guessed.
     */
    // Not transactional on purpose: the notices are delivered after their own transaction commits, and the count below reads what was delivered.
    public Map<String, Object> runReminders(UserAccount actor) {
        access.require(actor, PERMISSION);
        java.sql.Timestamp startedAt = jdbc.queryForObject("select now()", java.sql.Timestamp.class);
        int candidates = reminders.sendAll(LocalDate.now(TrainingNumberService.ZONE));

        String events = String.join(",", REMINDER_EVENTS.stream().map(e -> "?").toList());
        List<Object> args = new ArrayList<>();
        args.add(startedAt);
        args.addAll(REMINDER_EVENTS);
        Map<String, Long> byStatus = new LinkedHashMap<>(Map.of("SENT", 0L, "FAILED", 0L, "SKIPPED", 0L));
        for (Map<String, Object> row : jdbc.queryForList(
                "select status, count(*) as total from training_notification_log where created_at >= ? and event_code in (" + events + ") group by status", args.toArray())) {
            byStatus.put((String) row.get("status"), ((Number) row.get("total")).longValue());
        }

        audit.logAs(actor, "TRAINING_NOTIFICATIONS", "TRAINING_NOTIFICATIONS", AUDIT_ID, "TRAINING_REMINDERS_RUN", null, null,
                "Manual run of the Training reminders | candidates=" + candidates + "; sent=" + byStatus.get("SENT") + "; skipped=" + byStatus.get("SKIPPED") + "; failed=" + byStatus.get("FAILED"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("candidates", candidates);
        result.put("sent", byStatus.get("SENT"));
        result.put("skipped", byStatus.get("SKIPPED"));
        result.put("failed", byStatus.get("FAILED"));
        return result;
    }

    /** Sort keys of the log table; anything else sorts by the time the notice was written. */
    static String sortColumn(String sortBy) {
        return switch (sortBy == null ? "" : sortBy) {
            case "event" -> "l.event_code";
            case "recipient" -> "u.full_name";
            case "channel" -> "l.channel";
            case "status" -> "l.status";
            case "title" -> "l.title";
            default -> "l.created_at";
        };
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("TRAINING_DATE_INVALID");
        }
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
