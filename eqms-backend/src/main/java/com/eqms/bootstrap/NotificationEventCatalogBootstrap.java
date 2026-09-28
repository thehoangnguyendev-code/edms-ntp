package com.eqms.bootstrap;

import com.eqms.entity.NotificationEventDefinition;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Seeds the standard notification event catalog (Document Control, Controlled Copies,
 * Audit Trail, Security, System) plus a default ACTIVE policy and one default
 * IN_APP template version per event — so every event is immediately usable/visible in the
 * Notification Policy screen without a manual setup step. This feature is in-app/webapp
 * notifications only; email delivery is owned separately by the Email Templates feature.
 * Idempotent: only inserts events/policies/versions that don't already exist by code, so it is
 * safe to extend this catalog across releases without touching already-customized policies.
 */
@Component
@Order(6)
public class NotificationEventCatalogBootstrap implements ApplicationRunner {

    private final NotificationEventDefinitionRepository eventRepository;
    private final NotificationPolicyRepository policyRepository;
    private final NotificationTemplateVersionRepository templateVersionRepository;
    private final ObjectMapper objectMapper;

    public NotificationEventCatalogBootstrap(
            NotificationEventDefinitionRepository eventRepository,
            NotificationPolicyRepository policyRepository,
            NotificationTemplateVersionRepository templateVersionRepository,
            ObjectMapper objectMapper
    ) {
        this.eventRepository = eventRepository;
        this.policyRepository = policyRepository;
        this.templateVersionRepository = templateVersionRepository;
        this.objectMapper = objectMapper;
    }

    private record EventSeed(
            String code, String name, String description, String module, String priority,
            String complianceGroup, String relatedAction, String dataObject, String channels,
            String variables, boolean mandatory, String mandatoryReason,
            String[] defaultRecipientRoles, String inAppTitle, String inAppSummary
    ) {
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int order = 0;
        for (EventSeed seed : catalog()) {
            order += 10;
            NotificationEventDefinition event = eventRepository.findByCode(seed.code())
                    .orElseGet(() -> {
                        NotificationEventDefinition e = new NotificationEventDefinition();
                        e.setCode(seed.code());
                        return e;
                    });
            event.setName(seed.name());
            event.setDescription(seed.description());
            event.setModule(seed.module());
            event.setPriority(seed.priority());
            event.setComplianceGroup(seed.complianceGroup());
            event.setRelatedAction(seed.relatedAction());
            event.setDataObject(seed.dataObject());
            event.setSupportedChannels(seed.channels());
            event.setAvailableVariables(seed.variables());
            event.setMandatory(seed.mandatory());
            event.setMandatoryReason(seed.mandatoryReason());
            event.setActive(true);
            event.setDisplayOrder(order);
            eventRepository.save(event);

            if (!policyRepository.existsByEventCode(seed.code())) {
                NotificationPolicy policy = new NotificationPolicy();
                policy.setEventCode(seed.code());
                policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
                policy.setEnabledChannels(seed.channels());
                policy.setRecipientRules(buildDefaultRecipientRules(seed.defaultRecipientRoles()));
                policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
                policy.setEscalationEnabled(false);
                policy.setEscalationRecipientRules(objectMapper.createArrayNode());
                policy = policyRepository.save(policy);

                if (seed.channels().contains(NotificationTemplateVersion.CHANNEL_IN_APP)) {
                    templateVersionRepository.save(buildVersion(policy, NotificationTemplateVersion.CHANNEL_IN_APP,
                            seed.inAppTitle(), seed.inAppSummary(), seed.variables()));
                }
            }
        }
    }

    private NotificationTemplateVersion buildVersion(
            NotificationPolicy policy, String channel, String title, String summary, String variables
    ) {
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setPolicy(policy);
        version.setChannel(channel);
        version.setVersionNumber(1);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setTitle(title);
        version.setSummary(summary);
        version.setActionUrlTemplate("{{actionUrl}}");
        version.setVariablesUsed(variables);
        version.setChangeSummary("Seeded default content");
        return version;
    }

    private com.fasterxml.jackson.databind.JsonNode buildDefaultRecipientRules(String[] roles) {
        ArrayNode array = objectMapper.createArrayNode();
        for (String role : roles) {
            array.add(objectMapper.createObjectNode().put("type", role));
        }
        return array;
    }

    private static final String STD_VARS = "recipientName,documentNumber,documentTitle,revisionNumber,actionUrl,systemName";

    private List<EventSeed> catalog() {
        return List.of(
                // ── Document Control ────────────────────────────────────────────
                new EventSeed(
                        "document.submitted_for_review", "Document Submitted for Review",
                        "A document draft has been submitted and is awaiting reviewer action.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "SUBMIT_FOR_REVIEW", "DOCUMENT_REVISION", "IN_APP", STD_VARS, true,
                        "A Reviewer must not miss an assignment: the review cannot proceed unless they are told about it.",
                        new String[]{"REVIEWER"},
                        "Document ready for review", "{{documentNumber}} — {{documentTitle}} is awaiting your review."
                ),
                new EventSeed(
                        "document.review_completed", "Document Review Completed",
                        "All reviewers have completed their review of a document revision.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "REVIEW_COMPLETE", "DOCUMENT_REVISION", "IN_APP", STD_VARS, true,
                        "The Approver (or next Reviewer) must be told the revision is waiting for them.",
                        new String[]{"AUTHOR", "APPROVER"},
                        "Review completed", "{{documentNumber}} — {{documentTitle}} review is complete and ready for approval."
                ),
                new EventSeed(
                        "document.review_rejected", "Document Review Rejected",
                        "A Reviewer rejected the revision; it is back in Draft.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "REVIEW_REJECT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",actorName,workflowComment", true,
                        "Everyone involved must know a review round was closed and why.",
                        new String[]{"AUTHOR", "REVIEWER"},
                        "Review rejected", "{{documentNumber}} — {{documentTitle}} was rejected in review by {{actorName}}: {{workflowComment}}"
                ),
                new EventSeed(
                        "document.approval_rejected", "Document Approval Rejected",
                        "The Approver rejected the revision; it is back in Draft.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "APPROVE_REJECT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",actorName,workflowComment", true,
                        "Everyone involved must know the approval was rejected and why.",
                        new String[]{"AUTHOR", "REVIEWER"},
                        "Approval rejected", "{{documentNumber}} — {{documentTitle}} was rejected at approval by {{actorName}}: {{workflowComment}}"
                ),
                new EventSeed(
                        "document.approved", "Document Approved",
                        "A document revision has been approved by all approvers.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_COMPLIANCE,
                        "APPROVE_COMPLETE", "DOCUMENT_REVISION", "IN_APP", STD_VARS, false, null,
                        new String[]{"AUTHOR", "OWNER"},
                        "Document approved", "{{documentNumber}} — {{documentTitle}} has been approved."
                ),
                new EventSeed(
                        "knowledge.document_published", "Knowledge Document Published",
                        "A new Effective document was published in a Knowledge Base the user subscribed to.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_LOW, NotificationEventDefinition.COMPLIANCE_OPTIONAL,
                        "PUBLISH", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",knowledgeBase", false, null,
                        new String[]{"RECIPIENT"},
                        "New in {{knowledgeBase}}", "{{documentNumber}} — {{documentTitle}} (Rev {{revisionNumber}}) is now Effective."
                ),
                new EventSeed(
                        "document.upgrade_ready", "Document Ready for Upgrade",
                        "The DCO configured the next revision of an Active document; its Author may now upload the new revision.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "CONFIGURE_NEXT_REVISION", "DOCUMENT", "IN_APP", STD_VARS, true,
                        "The Author only gets Upload Revision after this configuration; without a notice the upgrade would go unnoticed.",
                        new String[]{"AUTHOR"},
                        "Document ready for upgrade", "{{documentNumber}} — {{documentTitle}} has been configured for upgrade. You can now upload the new revision."
                ),
                new EventSeed(
                        "document.participant_unavailable", "Workflow Assignee Unavailable",
                        "A Reviewer or Approver with a pending action was suspended or terminated; the assignment must be replaced.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "REPLACE_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,userName", true,
                        "Document Control must know a revision cannot progress until the assignment is replaced.",
                        new String[]{"RECIPIENT"},
                        "Workflow assignee unavailable",
                        "{{documentNumber}} — {{documentTitle}}: the pending {{participantType}} {{userName}} is no longer available. Replace the assignment so the revision can continue."
                ),
                new EventSeed(
                        "document.action_reminder", "Pending Review/Approval Reminder",
                        "A Reviewer or Approver has had a revision waiting for their action for longer than the configured reminder period.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "REMIND_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,daysPending", true,
                        "A revision waiting on a person for days must keep reminding that person.",
                        new String[]{"RECIPIENT"},
                        "Action pending",
                        "{{documentNumber}} — {{documentTitle}} has been waiting for your {{participantType}} action for {{daysPending}} day(s)."
                ),
                new EventSeed(
                        "document.action_escalated", "Pending Review/Approval Escalation",
                        "A revision has been waiting on a Reviewer or Approver for longer than the configured escalation period.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "ESCALATE_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,userName,daysPending", true,
                        "Document Control must be told when a revision is stuck.",
                        new String[]{"RECIPIENT"},
                        "Revision stuck in workflow",
                        "{{documentNumber}} — {{documentTitle}} has been waiting for {{participantType}} {{userName}} for {{daysPending}} day(s)."
                ),
                new EventSeed(
                        "document.published", "Document Published (Effective)",
                        "A document revision has been published and is now the effective version.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "PUBLISH", "DOCUMENT_REVISION", "IN_APP", STD_VARS, true,
                        "GMP requires all workflow participants (author, reviewers, approvers) to be notified when a document becomes effective.",
                        new String[]{"AUTHOR", "REVIEWER", "APPROVER"},
                        "Document is now effective", "{{documentNumber}} — {{documentTitle}} (Rev {{revisionNumber}}) is now Effective."
                ),
                new EventSeed(
                        // TBR-DOC-016: Document Obsolete notification. Mandatory/GMP so it always
                        // fires (bypassing recipient preference/quiet-hours/digest) for Author + the
                        // permission-equivalent DCO/Coordinator audience; Distributed-copy recipients
                        // affected by the cascade are added as explicit recipients at dispatch time
                        // (see DocumentObsoleteNotificationService), not via defaultRecipientRoles.
                        "document.obsoleted", "Document Obsoleted",
                        "A document master record has been obsoleted.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "OBSOLETE", "DOCUMENT", "IN_APP", STD_VARS, true,
                        "GMP requires the document's author, the document coordinator, and recipients of controlled copies that were distributed and became obsoleted by this action to be notified when a document is obsoleted.",
                        new String[]{"AUTHOR", "OWNER"},
                        "Document obsoleted", "{{documentNumber}} — {{documentTitle}} has been obsoleted."
                ),
                new EventSeed(
                        "document.periodic_review_due", "Document Periodic Review Due",
                        "A published document is approaching its periodic review date.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_COMPLIANCE,
                        "REVIEW_DUE", "DOCUMENT", "IN_APP", STD_VARS, false, null,
                        new String[]{"OWNER", "AFFECTED_USERS"},
                        "Periodic review due", "{{documentNumber}} — {{documentTitle}} is due for periodic review."
                ),

                // ── Controlled Copies ───────────────────────────────────────────
                new EventSeed(
                        "controlled_copy.distributed", "Controlled Copy Distributed",
                        "A controlled copy has been issued/distributed to a recipient.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "DISTRIBUTE", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber,expiryDateDisplay", true,
                        "Recipients must be notified of controlled copy issuance for distribution traceability (21 CFR Part 11 / Annex 11).",
                        new String[]{"RECIPIENT"},
                        "Controlled copy available", "A new controlled copy is available: {{documentTitle}}."
                ),
                new EventSeed(
                        "controlled_copy.recalled", "Controlled Copy Recalled",
                        "A controlled copy has been recalled and must no longer be used.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_CRITICAL, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "RECALL", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber,recallReason", true,
                        "Recalled controlled copies must be actively communicated to holders to prevent use of an invalid copy.",
                        new String[]{"RECIPIENT"},
                        "Controlled copy recalled", "{{controlledCopyNumber}} has been recalled. Reason: {{recallReason}}."
                ),
                new EventSeed(
                        "controlled_copy.expiring_soon", "Controlled Copy Expiring Soon",
                        "A distributed controlled copy is approaching its expiry date.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_COMPLIANCE,
                        "EXPIRY_REMINDER", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber,expiryDateDisplay", false, null,
                        new String[]{"RECIPIENT"},
                        "Controlled copy expiring soon", "{{controlledCopyNumber}} expires on {{expiryDateDisplay}}."
                ),
                new EventSeed(
                        "controlled_copy.destroyed", "Controlled Copy Destroyed",
                        "A controlled copy has been destroyed and its destruction recorded.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "DESTROY", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber", true,
                        "Destruction of a controlled copy must be recorded and communicated for chain-of-custody.",
                        new String[]{"RECIPIENT", "OWNER"},
                        "Controlled copy destroyed", "{{controlledCopyNumber}} has been destroyed."
                ),

                // ── Audit Trail ──────────────────────────────────────────────────
                new EventSeed(
                        "audit_trail.review_campaign_assigned", "Audit Trail Review Campaign Assigned",
                        "An audit trail review campaign has been assigned to a reviewer.",
                        "AUDIT_TRAIL", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_OPTIONAL,
                        "ASSIGN", "AUDIT_TRAIL_REVIEW_CAMPAIGN", "IN_APP", STD_VARS + ",campaignName", false, null,
                        new String[]{"ASSIGNEE"},
                        "Audit review assigned", "You have been assigned audit review campaign {{campaignName}}."
                ),
                new EventSeed(
                        "audit_trail.export_completed", "Audit Trail Export Completed",
                        "A requested audit trail export has finished generating.",
                        "AUDIT_TRAIL", NotificationEventDefinition.PRIORITY_LOW, NotificationEventDefinition.COMPLIANCE_OPTIONAL,
                        "EXPORT", "AUDIT_LOG", "IN_APP", STD_VARS, false, null,
                        new String[]{"OWNER"},
                        "Export ready", "Your audit trail export is ready to download."
                ),

                // ── Security ─────────────────────────────────────────────────────
                new EventSeed(
                        "security.password_changed", "Password Changed",
                        "A user's password has been changed.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "CHANGE_PASSWORD", "USER_ACCOUNT", "IN_APP", STD_VARS, true,
                        "Security-relevant account changes must always notify the account owner.",
                        new String[]{"OWNER"},
                        "Password changed", "Your password was recently changed."
                ),
                new EventSeed(
                        "security.mfa_updated", "MFA Settings Updated",
                        "A user's multi-factor authentication settings have changed.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "UPDATE_MFA", "USER_ACCOUNT", "IN_APP", STD_VARS, true,
                        "MFA changes must always be communicated to the account owner for account security.",
                        new String[]{"OWNER"},
                        "MFA settings updated", "Your multi-factor authentication settings were updated."
                ),
                new EventSeed(
                        "security.access_profile_changed", "Access Profile Changed",
                        "A user's assigned access profile(s) have changed.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_COMPLIANCE,
                        "UPDATE_ACCESS", "USER_ACCOUNT", "IN_APP", STD_VARS, false, null,
                        new String[]{"OWNER"},
                        "Access profile updated", "Your access profile assignment has changed."
                ),
                new EventSeed(
                        "security.account_locked", "Account Locked",
                        "A user account has been locked after repeated failed sign-in attempts.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY,
                        "LOCK_ACCOUNT", "USER_ACCOUNT", "IN_APP", STD_VARS, true,
                        "Account lockouts must always notify the affected user.",
                        new String[]{"OWNER"},
                        "Account locked", "Your account has been locked due to repeated failed sign-in attempts."
                ),
                new EventSeed(
                        "user.time_limited_access_expired", "Time-Limited User Access Expired",
                        "A \"Time-Limited User\" grant window has ended and the account was automatically suspended.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_OPTIONAL,
                        "TIME_LIMITED_EXPIRE", "USER_ACCOUNT", "IN_APP", STD_VARS, false, null,
                        new String[]{"OWNER"},
                        "Your access has expired", "Your time-limited access ended on {{endDate}} and your account has been suspended."
                ),

                // ── System ───────────────────────────────────────────────────────
                new EventSeed(
                        "system.preference_updated", "Notification Preference Updated",
                        "A user's notification/security preference has been updated.",
                        "SYSTEM", NotificationEventDefinition.PRIORITY_LOW, NotificationEventDefinition.COMPLIANCE_OPTIONAL,
                        "UPDATE_PREFERENCE", "USER_PREFERENCE", "IN_APP", STD_VARS, false, null,
                        new String[]{"OWNER"},
                        "Preference updated", "Your preference or security setting has been updated."
                ),
                new EventSeed(
                        "system.maintenance_scheduled", "System Maintenance Scheduled",
                        "A system maintenance window has been scheduled.",
                        "SYSTEM", NotificationEventDefinition.PRIORITY_MEDIUM, NotificationEventDefinition.COMPLIANCE_OPTIONAL,
                        "SCHEDULE_MAINTENANCE", "SYSTEM", "IN_APP", STD_VARS, false, null,
                        new String[]{"ALL_USERS"},
                        "Maintenance scheduled", "A system maintenance window has been scheduled."
                )
        );
    }
}
