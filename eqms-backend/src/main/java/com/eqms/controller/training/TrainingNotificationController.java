package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingAccess;
import com.eqms.service.training.TrainingNumberService;
import com.eqms.service.training.TrainingReminderScheduler;
import com.eqms.service.training.TrainingRows;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Administration of the notices of Training Management: the log of what was sent, and a manual run of the reminders. */
@RestController
@RequestMapping("/training/notifications")
public class TrainingNotificationController {
    private final TrainingReminderScheduler reminders;
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final CurrentUserService users;

    public TrainingNotificationController(TrainingReminderScheduler reminders, JdbcTemplate jdbc, TrainingAccess access, CurrentUserService users) {
        this.reminders = reminders;
        this.jdbc = jdbc;
        this.access = access;
        this.users = users;
    }

    @GetMapping("/log")
    public ResponseEntity<?> log(@RequestParam(required = false) String status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        access.require(users.requireCurrentUser(), "training.admin.manage");
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        boolean filtered = status != null && !status.isBlank();
        Long total = filtered ? jdbc.queryForObject("select count(*) from training_notification_log where status=?", Long.class, status)
                : jdbc.queryForObject("select count(*) from training_notification_log", Long.class);
        String sql = "select l.id, l.event_code, l.channel, l.status, l.reason_code, l.object_type, l.object_id, l.title, l.created_at, u.full_name as recipient_name from training_notification_log l join app_users u on u.id = l.recipient_user_id"
                + (filtered ? " where l.status=?" : "") + " order by l.created_at desc limit ? offset ?";
        List<Map<String, Object>> rows = filtered ? jdbc.queryForList(sql, status, safeLimit, (safePage - 1) * safeLimit) : jdbc.queryForList(sql, safeLimit, (safePage - 1) * safeLimit);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/run-reminders")
    public ResponseEntity<?> run() {
        access.require(users.requireCurrentUser(), "training.admin.manage");
        return ResponseEntity.ok(Map.of("reminders", reminders.sendAll(LocalDate.now(TrainingNumberService.ZONE))));
    }
}
