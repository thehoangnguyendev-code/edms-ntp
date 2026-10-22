package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingNotificationAdminService;
import com.eqms.service.training.TrainingNotificationAdminService.LogQuery;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Administration of the notices of Training Management: the log of what was sent, and a manual run of the reminders. */
@RestController
@RequestMapping("/training/notifications")
public class TrainingNotificationController {
    private final TrainingNotificationAdminService notifications;
    private final CurrentUserService users;

    public TrainingNotificationController(TrainingNotificationAdminService notifications, CurrentUserService users) {
        this.notifications = notifications;
        this.users = users;
    }

    @GetMapping("/log")
    public ResponseEntity<?> log(@RequestParam(required = false) String search,
                                 @RequestParam(required = false) String status,
                                 @RequestParam(required = false) String channel,
                                 @RequestParam(required = false) String from,
                                 @RequestParam(required = false) String to,
                                 @RequestParam(required = false) String sortBy,
                                 @RequestParam(defaultValue = "desc") String sortDirection,
                                 @RequestParam(defaultValue = "1") int page,
                                 @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(notifications.log(users.requireCurrentUser(), new LogQuery(search, status, channel, from, to, sortBy, sortDirection, page, limit)));
    }

    @PostMapping("/run-reminders")
    public ResponseEntity<?> run() {
        return ResponseEntity.ok(notifications.runReminders(users.requireCurrentUser()));
    }
}
