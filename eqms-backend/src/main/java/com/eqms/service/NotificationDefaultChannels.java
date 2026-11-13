package com.eqms.service;

import java.util.Set;

/**
 * The channels a notification is sent on when it is created (owner decision 2026-11-12). The in-app notification is the working inbox and every notification has it. The
 * e-mail is the alert outside the session, and only a notification that someone has to act on, that is late, that changes a document or a copy they hold, or that
 * concerns security or the running of the system is also sent by e-mail; a notification that only tells a result or an event for information is in-app only. An
 * administrator changes the channels of each event in the Notifications Administration; this list is only where a new event, or a new system, starts.
 */
public final class NotificationDefaultChannels {

    private static final Set<String> ALSO_BY_EMAIL = Set.of(
            "document.action_escalated",
            "document.action_reminder",
            "document.approval_rejected",
            "document.approval_request",
            "document.expired",
            "document.expired_copy_holder",
            "document.obsoleted",
            "document.participant_unavailable",
            "document.periodic_review_due",
            "document.publishing_failed",
            "document.ready_for_publishing",
            "document.ready_for_submission",
            "document.review_rejected",
            "document.review_request",
            "document.revision_cancelled",
            "document.submitted_for_review",
            "document.training_required",
            "document.upgrade_ready",
            "controlled_copy.distribution_failed",
            "controlled_copy.distribution_notice",
            "controlled_copy.expiry_notice",
            "uncontrolled_copy.expired",
            "report.run_failed",
            "controlled_copy.lost_or_damaged",
            "controlled_copy.obsoleted_notice",
            "controlled_copy.recall_notice",
            "controlled_copy.recall_overdue",
            "controlled_copy.recalled",
            "controlled_copy.reissue_requested",
            "controlled_copy.requested",
            "access_review.campaign_assigned",
            "access_review.campaign_changed",
            "access_review.campaign_due",
            "audit_trail.review_campaign_assigned",
            "backup.alert",
            "backup.export_decided",
            "backup.policy_decided",
            "backup.restore_decided",
            "backup.restore_requested",
            "report.ready",
            "report.schedule_suspended",
            "report.template_submitted",
            "security.account_locked",
            "security.esignature_settings_changed",
            "security.mfa_updated",
            "security.password_changed",
            "security.refresh_token_reuse",
            "security.sod_constraint_changed",
            "user.account_suspended",
            "user.account_terminated",
            "user.time_limited_access_expired",
            "system.storage_usage_warning",
            "training.attendance_sent",
            "training.cancelled",
            "training.due_soon",
            "training.impact_waiting",
            "training.invited",
            "training.job_waiting",
            "training.legacy_imported",
            "training.makeup_pending",
            "training.matrix_rejected",
            "training.overdue",
            "training.periodic_requirement_due",
            "training.postponed",
            "training.preparation_assigned",
            "training.qa_confirm_waiting",
            "training.qa_list_late",
            "training.qa_list_today",
            "training.read_due_soon",
            "training.read_reminder",
            "training.requirement_due",
            "training.requirement_rejected",
            "training.results_due_today",
            "training.results_late",
            "training.returned",
            "training.review_close_due",
            "training.review_open_due",
            "training.review_ready",
            "training.step_assigned",
            "training.step_ready",
            "training.step_waiting",
            "training.submitted_to_qa",
            "training.work_resumed",
            "training.work_suspended"
    );

    private NotificationDefaultChannels() {
    }

    /** The default channels of an event: in-app, plus e-mail when the event is on the list and can be sent by e-mail. */
    public static String of(String eventCode, String supportedChannels) {
        boolean email = ALSO_BY_EMAIL.contains(eventCode) && supportedChannels != null && supportedChannels.contains("EMAIL");
        return email ? "IN_APP,EMAIL" : "IN_APP";
    }

    public static Set<String> alsoByEmail() {
        return ALSO_BY_EMAIL;
    }
}
