package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.NotificationDispatcher;
import com.eqms.service.OperationalNotificationEvents;
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
    static final String EVENT_RUN_FAILED = "REPORT_RUN_FAILED";
    static final String CHANNEL_IN_APP = "IN_APP";
    static final String CHANNEL_EMAIL = "EMAIL";

    private final JdbcTemplate jdbc;
    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final NotificationDispatcher dispatcher;

    public ReportDeliveryService(JdbcTemplate jdbc, UserAccountRepository users, PermissionEvaluationService permissions,
                                 NotificationDispatcher dispatcher) {
        this.jdbc = jdbc;
        this.users = users;
        this.permissions = permissions;
        this.dispatcher = dispatcher;
    }

    /** Tells the recipients of a scheduled run that its report is ready to view. Never throws. */
    public void notifyRecipientsOfCompletedRun(UUID runId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "select schedule_id, requester_user_id, coalesce(report_title, definition_code) as title from report_runs where id=?", runId);
            if (rows.isEmpty()) return;
            Map<String, Object> run = rows.getFirst();
            UUID requester = UUID.fromString(run.get("requester_user_id").toString());
            String title = String.valueOf(run.get("title"));
            if (run.get("schedule_id") == null) {
                // a report a person asked for themselves: they are told it is ready (the file is not sent, as for a schedule)
                Notice own = new Notice(EVENT_REPORT_READY, "Report ready: " + title,
                        "The report you asked for is ready to view. The file itself is not sent; open the link and sign in to see it.",
                        "/report/runs/" + runId, "REPORT_RUN", runId, runId, null);
                UserAccount owner = users.findById(requester).orElse(null);
                if (owner == null) { recordMissing(requester, own); return; }
                deliver(owner, own, owner.getStatus() == UserStatus.Active);
                return;
            }
            UUID scheduleId = UUID.fromString(run.get("schedule_id").toString());
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

    /** Tells the person who asked for a report that it could not be produced, once the run has failed for good (a run that will be tried again is not reported). Never throws. */
    public void notifyRequesterOfFailedRun(UUID runId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "select schedule_id, requester_user_id, status, coalesce(report_title, definition_code) as title from report_runs where id=?", runId);
            if (rows.isEmpty() || !"FAILED".equals(String.valueOf(rows.getFirst().get("status")))) return;
            Map<String, Object> run = rows.getFirst();
            UUID requester = UUID.fromString(run.get("requester_user_id").toString());
            UUID scheduleId = run.get("schedule_id") == null ? null : UUID.fromString(run.get("schedule_id").toString());
            Notice notice = new Notice(EVENT_RUN_FAILED, "Report failed: " + run.get("title"),
                    "The report could not be produced. Open the run to see the reason, or ask for it again.", "/report/runs/" + runId, "REPORT_RUN", runId, runId, scheduleId);
            UserAccount owner = users.findById(requester).orElse(null);
            if (owner == null) { recordMissing(requester, notice); return; }
            deliver(owner, notice, owner.getStatus() == UserStatus.Active);
        } catch (Exception failure) {
            log.error("The failed-run notice could not be processed for run {}: {}", runId, failure.getMessage(), failure);
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
            case "SUSPENDED_SIGNATURE_REQUIRED" -> "a report of this type is signed each time it is run, so it cannot run on a schedule";
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
        sendThroughRegistry(recipient, notice);
    }

    /**
     * Both notices go through the registry event of the report notice, so its policy applies (on or off, channels, wording, icon, e-mail design). What
     * the dispatch did is written to the delivery log channel by channel; a policy that is off or a channel that is off is a SKIPPED attempt, not a failure.
     */
    private void sendThroughRegistry(UserAccount recipient, Notice notice) {
        NotificationDispatcher.Outcome outcome;
        try {
            outcome = dispatcher.dispatchIndependently(OperationalNotificationEvents.reportRegistryCode(notice.event()), List.of(recipient),
                    NotificationDispatcher.noticeVariables(notice.title(), notice.message(), notice.path()));
        } catch (Exception failure) {
            record(recipient.getId(), CHANNEL_IN_APP, notice, "FAILED", failure.getClass().getSimpleName());
            record(recipient.getId(), CHANNEL_EMAIL, notice, "FAILED", failure.getClass().getSimpleName());
            return;
        }
        if (outcome == null) outcome = new NotificationDispatcher.Outcome("NOT_REGISTERED", false, false, false, false);
        String inApp = outcome.inAppReason();
        record(recipient.getId(), CHANNEL_IN_APP, notice, inApp == null ? "SENT" : "SKIPPED", inApp);
        String mail = outcome.emailReason(StringUtils.hasText(recipient.getEmail()));
        // a person without an address is a failure of the delivery as before; a policy or a channel that is off is a skipped attempt
        record(recipient.getId(), CHANNEL_EMAIL, notice, mail == null ? "SENT" : "NO_EMAIL_ADDRESS".equals(mail) || "NOT_SENT".equals(mail) ? "FAILED" : "SKIPPED", mail);
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
