package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.EmailNotificationService;
import com.eqms.service.NotificationService;
import com.eqms.service.PermissionEvaluationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * REPORT-NOTIFICATION-CHANNEL-2026-10-14 (in-app and e-mail, link only) and REPORT-SCHEDULE-OWNER-2026-10-14 (owner and creator told when a
 * schedule stops). A notice never carries the file. Each recipient is checked again at send time; each attempt, including a refusal or a
 * failure, is written to report_delivery_attempts. A failed notice never fails the report run that caused it.
 */
@Service
public class ReportDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(ReportDeliveryService.class);
    static final String EVENT_REPORT_READY = "REPORT_READY";
    static final String EVENT_SCHEDULE_SUSPENDED = "REPORT_SCHEDULE_SUSPENDED";
    static final String CHANNEL_IN_APP = "IN_APP";
    static final String CHANNEL_EMAIL = "EMAIL";

    private final JdbcTemplate jdbc;
    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final NotificationService notifications;
    private final EmailNotificationService email;

    public ReportDeliveryService(JdbcTemplate jdbc, UserAccountRepository users, PermissionEvaluationService permissions,
                                 NotificationService notifications, EmailNotificationService email) {
        this.jdbc = jdbc;
        this.users = users;
        this.permissions = permissions;
        this.notifications = notifications;
        this.email = email;
    }

    /** Tells the recipients of a scheduled run that its report is ready to view. Never throws. */
    public void notifyRecipientsOfCompletedRun(UUID runId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "select schedule_id, requester_user_id, coalesce(report_title, definition_code) as title from report_runs where id=?", runId);
            if (rows.isEmpty() || rows.getFirst().get("schedule_id") == null) return;
            Map<String, Object> run = rows.getFirst();
            UUID scheduleId = UUID.fromString(run.get("schedule_id").toString());
            UUID requester = UUID.fromString(run.get("requester_user_id").toString());
            String title = String.valueOf(run.get("title"));
            List<UUID> recipients = jdbc.queryForList("select user_id from report_schedule_recipients where schedule_id=? order by user_id", UUID.class, scheduleId);
            for (UUID recipientId : recipients) {
                Notice notice = new Notice(EVENT_REPORT_READY, "Report ready: " + title,
                        "A scheduled report is ready to view. The file itself is not sent; open the link and sign in to see it.",
                        "/report/runs/" + runId, "REPORT_RUN", runId, runId, scheduleId);
                UserAccount recipient = users.findById(recipientId).orElse(null);
                if (recipient == null) { recordMissing(recipientId, notice); continue; }
                deliver(recipient, notice, canOpenRun(recipient, requester));
            }
        } catch (Exception failure) {
            log.error("Report-ready notices could not be processed for run {}: {}", runId, failure.getMessage(), failure);
        }
    }

    /** Tells the owner and the creator that a schedule was suspended and will not run until someone resumes it. Never throws. */
    public void notifyScheduleSuspended(UUID scheduleId, String reason) {
        try {
            Map<String, Object> schedule = jdbc.queryForMap("select name, owner_user_id, creator_user_id from report_schedules where id=?", scheduleId);
            Set<UUID> targets = new LinkedHashSet<>();
            targets.add(UUID.fromString(schedule.get("owner_user_id").toString()));
            targets.add(UUID.fromString(schedule.get("creator_user_id").toString()));
            targets.addAll(reportAdministrators());
            String name = StringUtils.hasText(String.valueOf(schedule.get("name"))) ? String.valueOf(schedule.get("name")) : scheduleId.toString();
            Notice notice = new Notice(EVENT_SCHEDULE_SUSPENDED, "Scheduled report suspended: " + name,
                    "The schedule stopped running: " + suspensionText(reason) + ". It will not run again until it is resumed.",
                    "/report/scheduled", "REPORT_SCHEDULE", scheduleId, null, scheduleId);
            for (UUID targetId : targets) {
                UserAccount target = users.findById(targetId).orElse(null);
                if (target == null) { recordMissing(targetId, notice); continue; }
                // The notice names only the schedule and the reason, so it reaches an active owner or creator whether or not they
                // may open the schedules screen; the screen itself stays guarded when the link is followed.
                deliver(target, notice, target.getStatus() == UserStatus.Active);
            }
        } catch (Exception failure) {
            log.error("Suspension notices could not be processed for schedule {}: {}", scheduleId, failure.getMessage(), failure);
        }
    }

    /**
     * Report administrators are the active people who hold reports.schedule.manage (the rule chosen for REPORT-SCHEDULE-OWNER-2026-10-14,
     * owner's answer 2026-10-14: the admin account is the report administrator). Read at send time, so a grant or revocation applies at once.
     */
    private Set<UUID> reportAdministrators() {
        Set<UUID> admins = new LinkedHashSet<>();
        for (UserAccount user : users.findAll()) {
            if (user.getStatus() == UserStatus.Active && permissions.hasPermission(user, "reports.schedule.manage")) {
                admins.add(user.getId());
            }
        }
        return admins;
    }

    private static String suspensionText(String reason) {
        return switch (reason) {
            case "SUSPENDED_AUTHORIZATION_CHANGED" -> "the creator's permissions to run it changed";
            case "SUSPENDED_INVALID_SCHEDULE" -> "its timing or format is no longer valid";
            case "SUSPENDED_TEMPLATE_DISABLED" -> "its report template was disabled";
            case "SUSPENDED_TEMPLATE_NOT_APPROVED" -> "its report template is not approved for its current version";
            default -> "it was stopped by the system";
        };
    }

    /** A run is visible to its requester, or to anyone who may see all runs (the rule of ReportPlatformService.runDetail). */
    boolean canOpenRun(UserAccount recipient, UUID requester) {
        boolean active = recipient.getStatus() == UserStatus.Active;
        boolean moduleAndOwnRuns = permissions.hasPermission(recipient, "report.module.view") && permissions.hasPermission(recipient, "reports.run.view_own");
        return active && moduleAndOwnRuns && (recipient.getId().equals(requester) || permissions.hasPermission(recipient, "reports.run.view_all"));
    }

    private void deliver(UserAccount recipient, Notice notice, boolean authorized) {
        if (!authorized) {
            record(recipient.getId(), CHANNEL_IN_APP, notice, "SKIPPED_NOT_AUTHORIZED", null);
            record(recipient.getId(), CHANNEL_EMAIL, notice, "SKIPPED_NOT_AUTHORIZED", null);
            return;
        }
        sendInApp(recipient, notice);
        sendEmail(recipient, notice);
    }

    private void sendInApp(UserAccount recipient, Notice notice) {
        try {
            notifications.recordNotification(recipient, null, "personal", "Report", notice.event().toLowerCase().replace('_', '-'),
                    notice.title(), notice.message(), notice.path(), notice.entityType(), notice.entityId(), null, notice.title(),
                    "medium", null);
            record(recipient.getId(), CHANNEL_IN_APP, notice, "SENT", null);
        } catch (Exception failure) {
            record(recipient.getId(), CHANNEL_IN_APP, notice, "FAILED", failure.getClass().getSimpleName());
        }
    }

    private void sendEmail(UserAccount recipient, Notice notice) {
        if (!StringUtils.hasText(recipient.getEmail())) {
            record(recipient.getId(), CHANNEL_EMAIL, notice, "FAILED", "NO_EMAIL_ADDRESS");
            return;
        }
        try {
            String link = email.resolvePublicAppBaseUrl() + notice.path();
            String body = "<p>" + HtmlUtils.htmlEscape(notice.message()) + "</p>"
                    + "<p><a href=\"" + HtmlUtils.htmlEscape(link) + "\">Open in EQMS</a></p>";
            boolean sent = email.sendRenderedEmailWithTracking(recipient.getEmail(), "EQMS: " + notice.title(), body,
                    notice.event(), "REPORT", Map.of("fullName", StringUtils.hasText(recipient.getFullName()) ? recipient.getFullName() : recipient.getUsername()));
            record(recipient.getId(), CHANNEL_EMAIL, notice, sent ? "SENT" : "FAILED", sent ? null : "EMAIL_NOT_SENT");
        } catch (Exception failure) {
            record(recipient.getId(), CHANNEL_EMAIL, notice, "FAILED", failure.getClass().getSimpleName());
        }
    }

    private void recordMissing(UUID recipientId, Notice notice) {
        record(recipientId, CHANNEL_IN_APP, notice, "SKIPPED_NOT_AUTHORIZED", "RECIPIENT_NOT_FOUND");
        record(recipientId, CHANNEL_EMAIL, notice, "SKIPPED_NOT_AUTHORIZED", "RECIPIENT_NOT_FOUND");
    }

    private void record(UUID recipientId, String channel, Notice notice, String status, String reasonCode) {
        try {
            jdbc.update("insert into report_delivery_attempts(recipient_user_id,channel,event_code,run_id,schedule_id,status,reason_code,detail) values(?,?,?,?,?,?,?,?)",
                    recipientId, channel, notice.event(), notice.runId(), notice.scheduleId(), status, reasonCode, notice.title());
        } catch (Exception failure) {
            log.error("Delivery attempt for {} could not be recorded: {}", notice.event(), failure.getMessage(), failure);
        }
    }

    private record Notice(String event, String title, String message, String path, String entityType, UUID entityId, UUID runId, UUID scheduleId) {}
}
