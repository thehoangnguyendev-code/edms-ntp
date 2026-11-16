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
 * REPORT-NOTIFICATION-CHANNEL-2026-10-14 (in-app and e-mail) and REPORT-SCHEDULE-OWNER-2026-10-14 (owner and creator told when a
 * schedule stops). The notice of a report a person asked for themselves carries the file in its e-mail when it is small enough and a link that downloads it
 * after sign-in (REPORT-READY-FILE-2026-11-16, owner decision); every other notice stays a link only. Each recipient is checked again at send time; each attempt, including a refusal or a
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
    /** The most bytes of a report file that an e-mail carries; a larger file is not attached and the e-mail says so (the link still downloads it). */
    public static final int MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
        notifyRecipientsOfCompletedRun(runId, null, null);
    }

    /**
     * The same, with the file that was made: for a report a person asked for themselves it goes with their e-mail when it is not larger than {@link #MAX_ATTACHMENT_BYTES}.
     * The recipients of a schedule get the link only. Never throws.
     */
    public void notifyRecipientsOfCompletedRun(UUID runId, String fileName, byte[] file) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "select schedule_id, requester_user_id, coalesce(report_title, definition_code) as title from report_runs where id=?", runId);
            if (rows.isEmpty()) return;
            Map<String, Object> run = rows.getFirst();
            UUID requester = UUID.fromString(run.get("requester_user_id").toString());
            String title = String.valueOf(run.get("title"));
            if (run.get("schedule_id") == null) {
                // a report a person asked for themselves: they are told it is ready (the file is not sent, as for a schedule)
                boolean attach = file != null && fileName != null && file.length > 0 && file.length <= MAX_ATTACHMENT_BYTES;
                boolean tooLarge = file != null && file.length > MAX_ATTACHMENT_BYTES;
                String how = attach ? "The file is attached to this e-mail. You can also use the link below: sign in, and the file downloads at once."
                        : "Use the link below: sign in, and the file downloads at once." + (tooLarge ? " The file is larger than " + (MAX_ATTACHMENT_BYTES / (1024 * 1024)) + " MB, so it is not attached to this e-mail." : "");
                // The in-app notice only tells: no link and no file. The file is downloaded from the Action menu of the report in Report Run History, or from the e-mail.
                String inApp = "The report you asked for is ready. To download it, use the Action menu of the report in Report Run History, or the e-mail sent to you.";
                Notice own = new Notice(EVENT_REPORT_READY, "Report ready: " + title, "The report you asked for is ready. " + how,
                        "/report/runs/" + runId + "?download=1", "REPORT_RUN", runId, runId, null);
                UserAccount owner = users.findById(requester).orElse(null);
                if (owner == null) { recordMissing(requester, own); return; }
                // The file leaves the system only for a person who may open the run now (checked again at send time, as for every notice): otherwise the e-mail has the link only.
                deliverSplit(owner, own, inApp, owner.getStatus() == UserStatus.Active, attach && canOpenRun(owner, requester) ? new NotificationDispatcher.MailFile(fileName, file) : null);
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
            String cause = failureCause(runId);
            Notice notice = new Notice(EVENT_RUN_FAILED, "Report failed: " + run.get("title"),
                    "The report could not be produced. " + cause + " Ask for it again after the cause is corrected.", "/report/runs/" + runId, "REPORT_RUN", runId, runId, scheduleId);
            UserAccount owner = users.findById(requester).orElse(null);
            if (owner == null) { recordMissing(requester, notice); return; }
            if (scheduleId == null) deliverSplit(owner, notice, notice.message(), owner.getStatus() == UserStatus.Active, null);
            else deliver(owner, notice, owner.getStatus() == UserStatus.Active);
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

    /** What the run says went wrong, in words for a person: the text the worker wrote when it stopped the run, or the one of its reason code. */
    private String failureCause(UUID runId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("select reason_code, error_message from report_runs where id=?", runId);
            if (!rows.isEmpty()) {
                Object message = rows.getFirst().get("error_message");
                if (message != null && StringUtils.hasText(message.toString())) return "Cause: " + message.toString().trim();
                Object reason = rows.getFirst().get("reason_code");
                if (reason != null) return "Cause: " + reason + ".";
            }
        } catch (Exception unreadable) {
            log.warn("The cause of run {} could not be read: {}", runId, unreadable.getMessage());
        }
        return "The cause is on the run: open it in Report Run History.";
    }

    private void deliver(UserAccount recipient, Notice notice, boolean authorized) {
        deliver(recipient, notice, authorized, null);
    }

    /**
     * A notice whose in-app and e-mail say different things (REPORT-READY-FILE-2026-11-16): the in-app notice only tells, with no link and no file; the e-mail has the text of the
     * notice, its link and, when given, the file. Each channel is dispatched on its own and written to the delivery log on its own.
     */
    private void deliverSplit(UserAccount recipient, Notice notice, String inAppMessage, boolean authorized, NotificationDispatcher.MailFile file) {
        if (!authorized) {
            record(recipient.getId(), CHANNEL_IN_APP, notice, "SKIPPED_NOT_AUTHORIZED", null);
            record(recipient.getId(), CHANNEL_EMAIL, notice, "SKIPPED_NOT_AUTHORIZED", null);
            return;
        }
        String code = OperationalNotificationEvents.reportRegistryCode(notice.event());
        NotificationDispatcher.Outcome inApp;
        try {
            inApp = dispatcher.dispatchIndependently(code, List.of(recipient), NotificationDispatcher.noticeVariables(notice.title(), inAppMessage, ""), java.util.Set.of("IN_APP"));
        } catch (Exception failure) {
            record(recipient.getId(), CHANNEL_IN_APP, notice, "FAILED", failure.getClass().getSimpleName());
            inApp = null;
        }
        if (inApp != null) {
            String reason = inApp.inAppReason();
            record(recipient.getId(), CHANNEL_IN_APP, notice, reason == null ? "SENT" : "SKIPPED", reason);
        }
        NotificationDispatcher.Outcome mail;
        try {
            var variables = NotificationDispatcher.noticeVariables(notice.title(), notice.message(), notice.path());
            mail = file == null ? dispatcher.dispatchIndependently(code, List.of(recipient), variables, java.util.Set.of("EMAIL"))
                    : dispatcher.dispatchIndependently(code, List.of(recipient), variables, java.util.Set.of("EMAIL"), file);
        } catch (Exception failure) {
            record(recipient.getId(), CHANNEL_EMAIL, notice, "FAILED", failure.getClass().getSimpleName());
            return;
        }
        if (mail == null) mail = new NotificationDispatcher.Outcome("NOT_REGISTERED", false, false, false, false);
        String reason = mail.emailReason(StringUtils.hasText(recipient.getEmail()));
        record(recipient.getId(), CHANNEL_EMAIL, notice, reason == null ? "SENT" : "NO_EMAIL_ADDRESS".equals(reason) || "NOT_SENT".equals(reason) ? "FAILED" : "SKIPPED", reason);
    }

    private void deliver(UserAccount recipient, Notice notice, boolean authorized, NotificationDispatcher.MailFile file) {
        if (!authorized) {
            record(recipient.getId(), CHANNEL_IN_APP, notice, "SKIPPED_NOT_AUTHORIZED", null);
            record(recipient.getId(), CHANNEL_EMAIL, notice, "SKIPPED_NOT_AUTHORIZED", null);
            return;
        }
        sendThroughRegistry(recipient, notice, file);
    }

    /**
     * Both notices go through the registry event of the report notice, so its policy applies (on or off, channels, wording, icon, e-mail design). What
     * the dispatch did is written to the delivery log channel by channel; a policy that is off or a channel that is off is a SKIPPED attempt, not a failure.
     */
    private void sendThroughRegistry(UserAccount recipient, Notice notice, NotificationDispatcher.MailFile file) {
        NotificationDispatcher.Outcome outcome;
        try {
            var variables = NotificationDispatcher.noticeVariables(notice.title(), notice.message(), notice.path());
            outcome = file == null
                    ? dispatcher.dispatchIndependently(OperationalNotificationEvents.reportRegistryCode(notice.event()), List.of(recipient), variables)
                    : dispatcher.dispatchIndependently(OperationalNotificationEvents.reportRegistryCode(notice.event()), List.of(recipient), variables, file);
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
