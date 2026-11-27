package com.eqms.service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Notifications raised by what the Audit Trail records. An event may name {@code contextSql}: a query that gives, from the id of the audited record, the people the
 * module would have named (the person who requested a copy), who are then the context of the event for rules such as OWNER. An action that changes somebody's duties (a restore requested, a report template waiting for approval,
 * a campaign created, a possible session theft) is already written to the Audit Trail by the module that does it; this list says which of those actions are
 * also notified, to whom by default, and where the person goes. {@link AuditNotificationBridge} dispatches the event once the action is committed. The people
 * are rules of the policy, so the administrator chooses them in the Notifications Administration; an event that is raised very often is off by default.
 */
public final class AuditNotificationEvents {

    /** @param value the permission, role or department of an audience rule; null for a rule that needs none */
    public record Rule(String type, String value) {
    }

    /**
     * @param entityTypes the kinds of record the action is written for (compared without regard to case, spaces or underscores)
     * @param actions     the action codes of the Audit Trail that raise the event
     */
    public record Event(String code, String name, String description, String module, String priority, String defaultStatus, List<Rule> rules,
                        List<String> entityTypes, List<String> actions, String actionUrl, String contextSql) {
        public Event(String code, String name, String description, String module, String priority, String defaultStatus, List<Rule> rules,
                     List<String> entityTypes, List<String> actions, String actionUrl) {
            this(code, name, description, module, priority, defaultStatus, rules, entityTypes, actions, actionUrl, null);
        }
    }

    private static final List<Event> ALL = List.of(
            new Event("audit_trail.review_campaign_assigned", "Audit Trail Review Campaign Assigned", "An audit trail review campaign was created and its reviewer is told, with the people who manage reviews.", "AUDIT_TRAIL", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null), new Rule("PERMISSION", "audit.review.manage")), List.of("AUDIT_TRAIL_REVIEW"), List.of("AUDIT_TRAIL_REVIEW_CAMPAIGN_CREATED"), "/audit-trail/reviews",
                    "select reviewer_id from audit_trail_review_campaigns where id = ?"),
            new Event("audit_trail.export_completed", "Audit Trail Export Completed", "The person who exported the audit trail is told that the export was done.", "AUDIT_TRAIL", "LOW", "ACTIVE", List.of(new Rule("ACTOR", null)), List.of("AUDIT_TRAIL"), List.of("EXPORT"), "/audit-trail"),
            // NOTIFICATION-REVIEW-2026-11-21 (owner chose these gaps): what happens to a person's account is told to the person, and what changes
            // who may approve or what a campaign decided is told to the people who manage it. The person is found from the audited record (the
            // id of a USER record is the id of the account), the details of the account are never in the notice.
            new Event("user.account_created", "Account Created", "A user account was created. The person it was created for is told that it exists; the sign-in details come from the administrator and are never in the notice.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("USER"), List.of("USER_CREATED"), "/",
                    "select id from app_users where id = ?"),
            new Event("user.account_reinstated", "Account Reinstated", "A suspended user account was reinstated. The person is told that they can sign in again.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("USER"), List.of("USER_REINSTATED"), "/",
                    "select id from app_users where id = ?"),
            new Event("user.time_limited_access_changed", "Time-Limited Access Granted or Changed", "A time-limited access window was granted, changed or cancelled. The person it concerns is told.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("USER"),
                    List.of("TIME_LIMITED_USER_GRANT_CREATED", "TIME_LIMITED_USER_GRANT_UPDATED", "TIME_LIMITED_USER_GRANT_CANCELLED"), "/",
                    "select id from app_users where id = ?"),
            new Event("security.workflow_policy_changed", "Workflow Authorization Policy Changed", "A workflow action policy was activated or its relations were changed: it decides who may review, approve or act on a record.", "SECURITY", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "security.workflow_authorization.manage")), List.of("WORKFLOW_ACTION_POLICY"),
                    List.of("WORKFLOW_ACTION_POLICY_ACTIVATED", "WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED"), "/security/lifecycle-policies"),
            new Event("access_review.campaign_completed", "Access Review Completed", "An access review campaign was completed and signed. The person who created it is told.", "ACCESS_REVIEW", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("ACCESS_REVIEW"), List.of("ACCESS_REVIEW_CAMPAIGN_COMPLETED"), "/security/access-review",
                    "select created_by from access_review_campaigns where id = ?"),
            new Event("access_review.campaign_assigned", "Access Review Assigned", "An access review campaign was created and its reviewer is told that there is access to review.", "ACCESS_REVIEW", "HIGH", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("ACCESS_REVIEW"), List.of("ACCESS_REVIEW_CAMPAIGN_CREATED"), "/security/access-review",
                    "select reviewer_id from access_review_campaigns where id = ?"),
            new Event("document.review_comment", "Review Comment on a Revision", "A review comment was added, answered or resolved on a revision. The author and the people of the workflow are told, not the person who wrote it.", "DOCUMENT_CONTROL", "LOW", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("REVISION"), List.of("REVIEW_COMMENT_ADDED", "REVIEW_COMMENT_REPLY_ADDED", "REVIEW_COMMENT_RESOLVED"), "/documents/all",
                    "select author_user_id from document_revisions where id = ? union select user_id from workflow_participants where object_id = ?"),
            new Event("uncontrolled_copy.expired", "Uncontrolled Copy Expired", "An uncontrolled copy passed its validity and can no longer be viewed. The person who requested it is told.", "CONTROLLED_COPIES", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("UNCONTROLLED_COPY"), List.of("EXPIRE"), "/documents/uncontrolled-copies/all",
                    "select requested_by_user_id from uncontrolled_copies where id = ?"),
            new Event("uncontrolled_copy.request_decided", "Uncontrolled Copy Request Cancelled", "The request of an uncontrolled copy was cancelled. The person who requested it is told, not the person who cancelled it.", "CONTROLLED_COPIES", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("UNCONTROLLED_COPY"), List.of("CANCEL"), "/documents/uncontrolled-copies/all",
                    "select requested_by_user_id from uncontrolled_copies where id = ?"),
            new Event("backup.inspection_decided", "Backup Inspection Requested or Approved", "A backup inspection was requested or approved.", "BACKUP_RESTORE", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null), new Rule("PERMISSION", "backup.admin.view")), List.of("BACKUP_INSPECTION"), List.of("INSPECTION_REQUESTED", "INSPECTION_APPROVED"), "/settings/administration/backup",
                    "select user_id from audit_logs where entity_id = ? and action_type = 'INSPECTION_REQUESTED' order by event_time limit 1"),
            new Event("backup.store_scrub_started", "Backup Store Scrub Started", "A scrub of the backup store started.", "BACKUP_RESTORE", "LOW", "ACTIVE", List.of(new Rule("PERMISSION", "backup.admin.view")), List.of("BACKUP_STORE_SCRUB"), List.of("STORE_SCRUB_STARTED"), "/settings/administration/backup"),
            new Event("report.type_or_property_changed", "Report Type or Property Changed", "A report type was enabled or disabled, or the report properties or the report appearance were changed.", "REPORTS", "LOW", "ACTIVE", List.of(new Rule("PERMISSION", "reports.definition.manage")), List.of("REPORT_TYPE", "REPORT_PROPERTIES", "REPORT_APPEARANCE"), List.of("REPORT_TYPE_ENABLED", "REPORT_TYPE_DISABLED", "REPORT_PROPERTIES_UPDATED", "REPORT_APPEARANCE_UPDATED"), "/report/templates"),
            new Event("security.permission_set_changed", "Permission Set Changed", "A permission set was created, changed or deleted.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "security.sod.manage")), List.of("PERMISSION_SET"), List.of("CREATED", "UPDATED", "DELETED"), "/security/permission-sets"),
            new Event("security.sod_constraint_changed", "Segregation of Duties Constraint Changed", "A segregation-of-duties constraint was created or deleted.", "SECURITY", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "security.sod.manage")), List.of("SOD_CONSTRAINT"), List.of("CREATED", "DELETED"), "/security/sod"),
            new Event("security.object_access_rule_changed", "Knowledge Base Share Rule Changed", "A rule that shares a folder or a document of the Knowledge Base was created, changed or taken away.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "security.object_rules.manage")), List.of("OBJECT_ACCESS_RULE"), List.of("CREATED", "UPDATED", "DELETED"), "/security/access-review"),
            new Event("system.retention_blocked_deletion", "Retention Blocked a Deletion", "A deletion was refused because the retention period of the file has not ended.", "SYSTEM", "LOW", "ACTIVE", List.of(new Rule("PERMISSION", "settings.config_integrations.manage")), List.of("STORAGE_OBJECT"), List.of("DELETE_BLOCKED_BY_RETENTION"), "/settings/configuration/integrations"),
            new Event("knowledge.sharing_changed", "Knowledge Base Sharing Changed", "A share link or a share delegate was created, revoked or removed.", "KNOWLEDGE", "LOW", "ACTIVE", List.of(new Rule("PERMISSION", "settings.config_general.manage")), List.of("KNOWLEDGE_SHARE_LINK", "KNOWLEDGE_SHARE_DELEGATE"), List.of("CREATED", "REVOKED", "DELETED"), "/documents/knowledge/explorer"),
            new Event("document.legacy_import_finished", "Legacy Document Import Finished", "A document imported from paper became effective.", "DOCUMENT_CONTROL", "LOW", "DISABLED", List.of(new Rule("PERMISSION", "documents.admin.publishing_templates.manage")), List.of("REVISION"), List.of("LEGACY_IMPORT_EFFECTIVE"), "/documents/all"),
            new Event("document.number_changed", "Document Number Changed", "The number of a document was changed.", "DOCUMENT_CONTROL", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "documents.controlled_copy.distribute")), List.of("DOCUMENT"), List.of("DOCUMENT_NUMBER_CHANGED"), "/documents/all"),
            new Event("document.editing_lock_changed", "Editing Lock or Edit-Online Link Changed", "The editing of a revision was locked, or its edit-online link was revoked or restored.", "DOCUMENT_CONTROL", "LOW", "DISABLED", List.of(new Rule("PERMISSION", "documents.admin.publishing_templates.manage")), List.of("REVISION"), List.of("EDITING_LOCKED", "SHAREPOINT_LINK_REVOKED", "SHAREPOINT_LINK_RESTORED", "SHAREPOINT_LINK_RECREATED"), "/documents/all"),
            new Event("controlled_copy.request_decided", "Controlled Copy Request Approved", "The request of a controlled copy was approved. The person who asked for it is told (not the person who approved it).", "CONTROLLED_COPIES", "MEDIUM", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("CONTROLLED_COPY"), List.of("APPROVE"), "/documents/controlled-copies/all",
                    "select requested_by_user_id from controlled_copies where id = ?"),
            new Event("controlled_copy.recall_evidence_uploaded", "Controlled Copy Evidence Uploaded", "Evidence of a recall or a destruction was uploaded.", "CONTROLLED_COPIES", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "documents.controlled_copy.distribute")), List.of("CONTROLLED_COPY"), List.of("UPLOAD_EVIDENCE"), "/documents/controlled-copies/all"),
            new Event("controlled_copy.reissue_requested", "Controlled Copy Re-issue Requested", "A holder asked for a controlled copy to be issued again.", "CONTROLLED_COPIES", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "documents.controlled_copy.replace_lost_damaged")), List.of("CONTROLLED_COPY"), List.of("REISSUE_REQUESTED", "REPLACE_LOST_DAMAGED"), "/documents/controlled-copies/all"),
            new Event("backup.restore_requested", "Restore Requested", "A restore of the system was requested and waits to be decided.", "BACKUP_RESTORE", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "backup.restore.execute")), List.of("BACKUP_RESTORE"), List.of("RESTORE_REQUESTED", "PRODUCTION_RESTORE_REQUESTED"), "/backup-restore/production-restores"),
            new Event("backup.restore_decided", "Restore Decided", "A restore was approved, rejected, cancelled, scheduled or its window was locked.", "BACKUP_RESTORE", "HIGH", "ACTIVE", List.of(new Rule("OWNER", null), new Rule("PERMISSION", "backup.restore.execute")), List.of("BACKUP_RESTORE"), List.of("RESTORE_APPROVED", "RESTORE_REJECTED", "RESTORE_CANCELLED", "RESTORE_SCHEDULED", "RESTORE_WINDOW_LOCKED", "RESTORE_APPROVAL_REFUSED", "PRODUCTION_RESTORE_REFUSED", "PRODUCTION_RESTORE_FINALIZED", "PRODUCTION_RESTORE_FINALIZED_REFUSED"), "/backup-restore/production-restores",
                    "select user_id from audit_logs where entity_id = ? and action_type in ('RESTORE_REQUESTED','PRODUCTION_RESTORE_REQUESTED') order by event_time limit 1"),
            new Event("backup.export_decided", "Backup Export Requested or Decided", "A backup export was requested, approved or refused.", "BACKUP_RESTORE", "HIGH", "ACTIVE", List.of(new Rule("OWNER", null), new Rule("PERMISSION", "backup.admin.view")), List.of("BACKUP_EXPORT"), List.of("BACKUP_EXPORT_REQUESTED", "BACKUP_EXPORT_APPROVED", "BACKUP_EXPORT_APPROVAL_REFUSED"), "/settings/administration/backup",
                    "select user_id from audit_logs where entity_id = ? and action_type = 'BACKUP_EXPORT_REQUESTED' order by event_time limit 1"),
            new Event("backup.policy_decided", "Backup Policy Proposed or Decided", "A backup policy was proposed, activated or refused.", "BACKUP_RESTORE", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "backup.admin.policy.approve")), List.of("BACKUP_POLICY"), List.of("BACKUP_POLICY_PROPOSED", "BACKUP_POLICY_ACTIVATED", "BACKUP_POLICY_ACTIVATION_REFUSED"), "/settings/administration/backup/policy"),
            new Event("backup.rehearsal_requested", "Restore Rehearsal Requested", "A restore rehearsal was requested.", "BACKUP_RESTORE", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "backup.admin.view")), List.of("BACKUP"), List.of("RESTORE_REHEARSAL_REQUESTED"), "/settings/administration/backup"),
            new Event("report.template_submitted", "Report Template Submitted", "A report template was submitted and waits for approval.", "REPORTS", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "reports.definition.approve")), List.of("REPORT_DEFINITION"), List.of("REPORT_TEMPLATE_SUBMITTED"), "/report/templates"),
            // REPORT-TEMPLATE-REJECT-NOTICE-2026-11-15: the approver rejects a revision with a reason; the person who wrote it is told, in the application and by e-mail (the author is the person
            // of the last change to the revision recorded in the Audit Trail; the approver, who acted, is not told).
            new Event("report.template_rejected", "Report Template Rejected", "An approver rejected a revision of a report template; the person who wrote it is told with the reason, in the application and by e-mail.", "REPORTS", "HIGH", "ACTIVE", List.of(new Rule("OWNER", null)), List.of("REPORT_DEFINITION"), List.of("REPORT_TEMPLATE_REJECTED"), "/report/template-management",
                    "select user_id from audit_logs where entity_id = ? and action_type in ('REPORT_TEMPLATE_CREATED','REPORT_TEMPLATE_UPDATED','REPORT_TEMPLATE_REVISION_STARTED','REPORT_TEMPLATE_REVISION_UPDATED') order by event_time desc limit 1"),
            new Event("report.template_decided", "Report Template Approved or Disabled", "A report template was approved, enabled or disabled.", "REPORTS", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "reports.definition.manage")), List.of("REPORT_DEFINITION"), List.of("REPORT_TEMPLATE_APPROVED", "REPORT_TEMPLATE_DISABLED", "REPORT_TEMPLATE_ENABLED"), "/report/templates"),
            new Event("access_review.campaign_changed", "Access Review Campaign Created or Cancelled", "An access review campaign was created or cancelled.", "ACCESS_REVIEW", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "security.access_review.manage")), List.of("ACCESS_REVIEW"), List.of("ACCESS_REVIEW_CAMPAIGN_CREATED", "ACCESS_REVIEW_CAMPAIGN_CANCELLED"), "/security/access-review"),
            new Event("audit.review_campaign_changed", "Audit Trail Review Campaign Cancelled", "An audit trail review campaign was cancelled.", "AUDIT_TRAIL", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "audit.review.manage")), List.of("AUDIT_TRAIL_REVIEW"), List.of("AUDIT_TRAIL_REVIEW_CAMPAIGN_CANCELLED"), "/audit-trail/reviews"),
            new Event("security.refresh_token_reuse", "Possible Session Theft Detected", "A refresh token was used twice, which can mean the session was stolen. The person concerned and the administrators are told.", "SECURITY", "CRITICAL", "ACTIVE", List.of(new Rule("ACTOR", null), new Rule("PERMISSION", "settings.config_security.manage")), List.of("SESSION"), List.of("REFRESH_TOKEN_REUSE_DETECTED"), "/preferences"),
            new Event("security.esignature_settings_changed", "Electronic Signature Settings Changed", "The electronic signature settings were changed.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "settings.electronic_signature.manage")), List.of("ELECTRONIC_SIGNATURE_SETTINGS"), List.of("ELECTRONIC_SIGNATURE_SETTINGS_UPDATED"), "/settings/electronic-signature"),
            new Event("security.access_profile_changed_audit", "Access Profile Changed", "An access profile, its permissions or its members were changed.", "SECURITY", "MEDIUM", "ACTIVE", List.of(new Rule("PERMISSION", "security.sod.manage")), List.of("ACCESS_PROFILE"), List.of("ACCESS_PROFILE_CREATED", "ACCESS_PROFILE_DELETED", "ACCESS_PROFILE_PERMISSIONS_REPLACED", "ACCESS_PROFILE_PERMISSION_SETS_REPLACED", "ACCESS_PROFILE_WORKFLOW_ROLES_REPLACED", "ACCESS_PROFILE_USER_ASSIGNED", "ACCESS_PROFILE_USER_REMOVED"), "/security/access-profiles"),
            new Event("system.configuration_changed", "System Configuration Changed", "The system configuration was changed. Off by default: it is raised very often.", "SYSTEM", "LOW", "DISABLED", List.of(new Rule("PERMISSION", "settings.config_general.manage"), new Rule("PERMISSION", "settings.config_navigation_labels.manage"), new Rule("PERMISSION", "settings.config_security.manage"), new Rule("PERMISSION", "settings.config_notifications.manage"), new Rule("PERMISSION", "settings.config_integrations.manage"), new Rule("PERMISSION", "settings.config_preview_file.manage"), new Rule("PERMISSION", "settings.config_image_watermark.manage"), new Rule("PERMISSION", "settings.config_features.manage")), List.of("SYSTEM_CONFIGURATION", "SYSTEM_CONFIGURATION_GENERAL", "SYSTEM_CONFIGURATION_NAVIGATION_LABELS", "SYSTEM_CONFIGURATION_SECURITY", "SYSTEM_CONFIGURATION_NOTIFICATIONS", "SYSTEM_CONFIGURATION_INTEGRATIONS", "SYSTEM_CONFIGURATION_PREVIEW_FILE", "SYSTEM_CONFIGURATION_IMAGE_WATERMARK", "SYSTEM_CONFIGURATION_FEATURES"), List.of("SYSTEM_CONFIGURATION_UPDATED"), "/settings/configuration/general"),
            new Event("controlled_copy.requested", "Controlled Copy Requested", "A controlled copy or a batch of copies was requested and waits for the Document Control Officer.", "CONTROLLED_COPIES", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "documents.controlled_copy.distribute")), List.of("CONTROLLED_COPY", "CONTROLLED_COPY_DISTRIBUTION_BATCH"), List.of("REQUEST"), "/documents/controlled-copies/all"),
            new Event("controlled_copy.lost_or_damaged", "Controlled Copy Reported Lost or Damaged", "A holder reported a controlled copy lost or damaged.", "CONTROLLED_COPIES", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "documents.controlled_copy.replace_lost_damaged")), List.of("CONTROLLED_COPY"), List.of("REPORT_LOST", "REPORT_DAMAGED"), "/documents/controlled-copies/all"),
            new Event("controlled_copy.distribution_failed", "Controlled Copy Distribution Failed", "The processing of a distribution failed.", "CONTROLLED_COPIES", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "documents.controlled_copy.distribute")), List.of("CONTROLLED_COPY"), List.of("DISTRIBUTE_PROCESSING_FAILED"), "/documents/controlled-copies/all"),
            new Event("document.publishing_failed", "Publishing Package Failed", "The publishing package of a revision failed to publish.", "DOCUMENT_CONTROL", "HIGH", "ACTIVE", List.of(new Rule("PERMISSION", "documents.revision.open_publishing_workspace")), List.of("REVISION"), List.of("PUBLISHING_PACKAGE_FAILED"), "/documents/all"));

    private AuditNotificationEvents() {
    }

    public static List<Event> all() {
        return ALL;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    }

    /** The events an audited action raises (one action may tell the people who manage it and the person it concerns). */
    public static List<Event> forAction(String entityType, String actionType) {
        String type = normalize(entityType);
        String action = normalize(actionType);
        return ALL.stream().filter(e -> e.actions().contains(action) && e.entityTypes().stream().map(AuditNotificationEvents::normalize).anyMatch(type::equals)).toList();
    }
}
