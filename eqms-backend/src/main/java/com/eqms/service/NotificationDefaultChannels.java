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
            "controlled_copy.cancel_notice",
            "controlled_copy.notice",
            "document.edit_online",
            "document.publish_notice",
            "knowledge.share_notice",
            "access_review.campaign_completed",
            "audit.review_campaign_changed",
            "audit_trail.export_completed",
            "backup.inspection_decided",
            "backup.rehearsal_requested",
            "backup.store_scrub_started",
            "controlled_copy.recall_evidence_uploaded",
            "controlled_copy.request_decided",
            "document.editing_lock_changed",
            "document.legacy_import_finished",
            "document.number_changed",
            "knowledge.sharing_changed",
            "report.template_decided",
            "report.type_or_property_changed",
            "security.access_profile_changed_audit",
            "security.object_access_rule_changed",
            "security.permission_set_changed",
            "system.retention_blocked_deletion",
            "uncontrolled_copy.request_decided",
            "controlled_copy.destroyed",
            "controlled_copy.distributed",
            "document.published",
            "document.review_completed",
            "knowledge.document_published",
            "system.maintenance_scheduled",
            "training.content_rejected",
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
            "report.template_rejected",
            "report.template_submitted",
            "security.account_locked",
            "security.esignature_settings_changed",
            "security.mfa_updated",
            "security.password_changed",
            "security.refresh_token_reuse",
            "security.sod_constraint_changed",
            "user.account_created",
            "user.account_reinstated",
            "user.time_limited_access_changed",
            "user.time_limited_access_expiring",
            "user.access_profile_changed",
            "security.workflow_policy_changed",
            "user.account_suspended",
            "user.account_terminated",
            "user.time_limited_access_expired",
            "system.storage_usage_warning",
            "training.attendance_sent",
            "training.revision_ready",
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
            "training.step_waiting",
            "training.submitted_to_qa",
            "training.work_suspended"
    );

    /**
     * Events whose notice is the e-mail only (owner decision 2026-11-24): the person who has to know may not be in the system at that time, so the e-mail carries the whole
     * information; the in-app notification is for short results shown to the person who runs the training (see training.session_changed). An administrator may still turn the
     * in-app channel on.
     */
    private static final Set<String> EMAIL_ONLY = Set.of(
            "training.postponed",
            "training.session_cancelled",
            "training.trainer_assigned",
            "training.trainer_removed",
            // owner decision 2026-11-26: Document Control gets the e-mail; the in-app notice is document.training_completed (at the end of the training) and document.published
            "document.ready_for_publishing"
    );

    private NotificationDefaultChannels() {
    }

    /** The default channels of an event: in-app, plus e-mail when the event is on the list and can be sent by e-mail. */
    public static String of(String eventCode, String supportedChannels) {
        if (EMAIL_ONLY.contains(eventCode) && supportedChannels != null && supportedChannels.contains("EMAIL")) return "EMAIL";
        boolean email = ALSO_BY_EMAIL.contains(eventCode) && supportedChannels != null && supportedChannels.contains("EMAIL");
        return email ? "IN_APP,EMAIL" : "IN_APP";
    }

    public static Set<String> alsoByEmail() {
        return ALSO_BY_EMAIL;
    }
}
