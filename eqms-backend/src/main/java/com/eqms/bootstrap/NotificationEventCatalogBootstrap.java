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
            ObjectMapper objectMapper,
            com.eqms.repository.EmailTemplateRepository emailTemplateRepository
    ) {
        this.eventRepository = eventRepository;
        this.policyRepository = policyRepository;
        this.templateVersionRepository = templateVersionRepository;
        this.objectMapper = objectMapper;
        this.emailTemplateRepository = emailTemplateRepository;
    }

    private final com.eqms.repository.EmailTemplateRepository emailTemplateRepository;

    private record EventSeed(
            String code, String name, String description, String module, String priority,
            String relatedAction, String dataObject, String channels,
            String variables,
            String[] defaultRecipientRoles, String inAppTitle, String inAppSummary,
            com.fasterxml.jackson.databind.JsonNode rules, String status
    ) {
        EventSeed(String code, String name, String description, String module, String priority, String relatedAction, String dataObject, String channels,
                  String variables, String[] defaultRecipientRoles, String inAppTitle, String inAppSummary) {
            this(code, name, description, module, priority, relatedAction, dataObject, channels, variables, defaultRecipientRoles, inAppTitle, inAppSummary, null, null);
        }
    }

    /** The codes of every event this seeds (the registry events of the modules, Training, Reports, Backup, the audit-driven ones and those created from e-mail messages). */
    java.util.Set<String> seededCodes() {
        java.util.Set<String> codes = new java.util.TreeSet<>();
        catalog().forEach(seed -> codes.add(seed.code()));
        com.eqms.service.LegacyMessageEvents.all().forEach(e -> codes.add(e.code()));
        return codes;
    }

    /** Every placeholder the seeded events declare, for the contract test that keeps them inside the placeholder catalogue. */
    java.util.Set<String> declaredPlaceholders() {
        java.util.Set<String> names = new java.util.TreeSet<>();
        for (EventSeed seed : catalog()) {
            for (String name : seed.variables().split(",")) {
                if (!name.isBlank()) names.add(name.trim());
            }
        }
        return names;
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
            event.setRelatedAction(seed.relatedAction());
            event.setDataObject(seed.dataObject());
            event.setSupportedChannels(supportedChannels(seed));
            event.setAvailableVariables(seed.variables());
            event.setActive(true);
            event.setDisplayOrder(order);
            eventRepository.save(event);

            if (!policyRepository.existsByEventCode(seed.code())) {
                NotificationPolicy policy = new NotificationPolicy();
                policy.setEventCode(seed.code());
                String enabledChannels = "EMAIL".equals(supportedChannels(seed)) ? "EMAIL"
                        : com.eqms.service.NotificationDefaultChannels.of(seed.code(), supportedChannels(seed));
                policy.setStatus(seed.status() == null ? NotificationPolicy.STATUS_ACTIVE : seed.status());
                policy.setEnabledChannels(enabledChannels);
                policy.setRecipientRules(seed.rules() != null ? seed.rules() : buildDefaultRecipientRules(seed.defaultRecipientRoles()));
                policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
                policy.setEscalationEnabled(false);
                policy.setEscalationRecipientRules(objectMapper.createArrayNode());
                policy = policyRepository.save(policy);

                // an e-mail-only event has no in-app notification (a secret must not be kept as one)
                if (!"EMAIL".equals(supportedChannels(seed))) {
                    templateVersionRepository.save(buildVersion(policy, NotificationTemplateVersion.CHANNEL_IN_APP,
                            seed.inAppTitle(), seed.inAppSummary(), seed.variables()));
                }
                // an event that is sent by e-mail by default has e-mail wording: its own, or the in-app wording as a start
                String[] content = enabledChannels.contains(NotificationTemplateVersion.CHANNEL_EMAIL)
                        ? java.util.Objects.requireNonNullElseGet(emailContent(seed), () -> new String[]{"[EQMS] " + seed.inAppTitle(), "<p>" + seed.inAppSummary() + "</p>"})
                        : null;
                if (content != null) {
                    NotificationTemplateVersion email = buildVersion(policy, NotificationTemplateVersion.CHANNEL_EMAIL,
                            seed.inAppTitle(), seed.inAppSummary(), seed.variables());
                    email.setSubject(content[0]);
                    email.setBody(content[1]);
                    email.setActionLabel("Open in EQMS");
                    templateVersionRepository.save(email);
                }
            } else {
                // NOTIFICATION-REVIEW-2026-11-25: an event that can be sent by e-mail always has e-mail wording, also when it is sent in-app only by default; otherwise the administrator who
                // turns the e-mail on in the Notification Administration finds nothing to edit. An existing e-mail wording (edited or not) is never touched.
                NotificationPolicy policy = policyRepository.findByEventCode(seed.code()).orElse(null);
                if (policy != null && supportedChannels(seed).contains(NotificationTemplateVersion.CHANNEL_EMAIL)
                        && templateVersionRepository.countByPolicy_IdAndChannel(policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL) == 0) {
                    String[] content = java.util.Objects.requireNonNullElseGet(emailContent(seed), () -> new String[]{"[EQMS] " + seed.inAppTitle(), "<p>" + seed.inAppSummary() + "</p>"});
                    NotificationTemplateVersion email = buildVersion(policy, NotificationTemplateVersion.CHANNEL_EMAIL, seed.inAppTitle(), seed.inAppSummary(), seed.variables());
                    email.setSubject(content[0]);
                    email.setBody(content[1]);
                    email.setActionLabel("Open in EQMS");
                    email.setChangeSummary("Seeded default e-mail content (the event is sent in-app by default)");
                    templateVersionRepository.save(email);
                }
            }
        }
        seedLegacyMessageEvents();
    }

    /**
     * Events whose e-mail cannot go through the outbox stay in-app only: the notice of a maintenance window (the outbox does not run during maintenance; the
     * administrator address is e-mailed directly). Every other event can be sent on both channels: the channels it is sent on by default are
     * {@code seed.channels()}, and an administrator turns the others on.
     */
    private static final java.util.Set<String> IN_APP_ONLY = java.util.Set.of("backup.maintenance_drained");

    private static String supportedChannels(EventSeed seed) {
        if (com.eqms.service.NotificationMandatoryEvents.isMandatory(seed.code())) return "EMAIL";
        return IN_APP_ONLY.contains(seed.code()) ? "IN_APP" : "IN_APP,EMAIL";
    }

    /** NOTIFICATION-REVIEW-2026-11-25: the e-mail wording of events that were in-app only by default; the administrator edits it in the Notification Administration. */
    private static final java.util.Map<String, String[]> FULL_EMAIL_CONTENT = java.util.Map.ofEntries(
            java.util.Map.entry("access_review.campaign_completed", new String[]{"[EQMS] Access review completed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>The access review campaign you created was <b>completed and signed</b>. The result is kept as evidence of the periodic review of access.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("audit.review_campaign_changed", new String[]{"[EQMS] Audit trail review campaign cancelled: {{entityName}}", "<p>Dear {{recipientName}},</p><p>An audit trail review campaign was <b>cancelled</b>. The records it was to cover are not reviewed by this campaign.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("audit_trail.export_completed", new String[]{"[EQMS] Audit trail export ready: {{entityName}}", "<p>Dear {{recipientName}},</p><p>The audit trail export you asked for is <b>ready</b>. Open it from the Audit Trail screen; the file is available only to you.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("backup.inspection_decided", new String[]{"[EQMS] Backup inspection: {{actionName}}", "<p>Dear {{recipientName}},</p><p>A backup inspection was <b>requested or approved</b> ({{actionName}}). An inspection gives a controlled, read-only look at a backup set and needs the approval of a second person.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("backup.rehearsal_requested", new String[]{"[EQMS] Restore rehearsal requested: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A <b>restore rehearsal</b> was requested. A rehearsal restores a backup into a scratch environment to prove that it can be restored; it does not change the live system.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("backup.store_scrub_started", new String[]{"[EQMS] Backup store scrub started: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A <b>scrub of the backup store</b> started. The scrub checks every stored backup file against its recorded checksum.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("controlled_copy.recall_evidence_uploaded", new String[]{"[EQMS] Controlled copy evidence uploaded: {{entityName}}", "<p>Dear {{recipientName}},</p><p>Evidence of the <b>recall or destruction</b> of a controlled copy was uploaded. Document Control can now check it and close the recall.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("controlled_copy.request_decided", new String[]{"[EQMS] Controlled copy request approved: {{entityName}}", "<p>Dear {{recipientName}},</p><p>Your request for a controlled copy was <b>approved</b>. The copy will be issued to you by Document Control; you will be told when it is available.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("document.editing_lock_changed", new String[]{"[EQMS] Editing lock changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>The editing of a revision was <b>locked</b>, or its edit-online link was <b>revoked or restored</b> ({{actionName}}).</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("document.legacy_import_finished", new String[]{"[EQMS] Legacy document imported: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A document imported from paper is now <b>effective</b>. Check that its number, revision and valid-until date are the ones of the paper original.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("document.number_changed", new String[]{"[EQMS] Document number changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>The <b>number of a document was changed</b>. Printed controlled copies still carry the old number: Document Control must check them and, if needed, issue them again.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("knowledge.sharing_changed", new String[]{"[EQMS] Knowledge Base sharing changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A <b>share link or a share delegate</b> of the Knowledge Base was created, revoked or removed ({{actionName}}). Check that nothing was shared outside the company by mistake.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("report.template_decided", new String[]{"[EQMS] Report template decided: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A report template was <b>approved, enabled or disabled</b> ({{actionName}}). Reports made from it follow the new state from now on.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("report.type_or_property_changed", new String[]{"[EQMS] Report setting changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A <b>report type</b> was enabled or disabled, or the <b>report properties or appearance</b> were changed ({{actionName}}). Reports made from now on use the new setting.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("security.access_profile_changed_audit", new String[]{"[EQMS] Access profile changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>An <b>access profile</b>, its permissions or its members were changed ({{actionName}}). The people in the profile may now do more or less than before.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("security.object_access_rule_changed", new String[]{"[EQMS] Object access rule changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>An <b>object access rule</b> was created, changed or deleted ({{actionName}}). It decides which records a person can see.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("security.permission_set_changed", new String[]{"[EQMS] Permission set changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A <b>permission set</b> was created, changed or deleted ({{actionName}}). Every profile that holds the set is affected.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("system.configuration_changed", new String[]{"[EQMS] System configuration changed: {{entityName}}", "<p>Dear {{recipientName}},</p><p>The <b>system configuration</b> was changed ({{actionName}}).</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("system.retention_blocked_deletion", new String[]{"[EQMS] Retention blocked a deletion: {{entityName}}", "<p>Dear {{recipientName}},</p><p>A <b>deletion was refused</b> because the retention period of the file has not ended. The file is unchanged.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("uncontrolled_copy.request_decided", new String[]{"[EQMS] Uncontrolled copy request cancelled: {{entityName}}", "<p>Dear {{recipientName}},</p><p>Your request for an uncontrolled copy was <b>cancelled</b>. No copy was issued.</p><p><b>Record:</b> {{entityName}}<br/><b>Done by:</b> {{actorName}}</p><p>{{actionComment}}</p><p>This notice is kept in the Audit Trail of the record.</p>"}),
            java.util.Map.entry("controlled_copy.destroyed", new String[]{"[EQMS] Controlled copy destroyed: {{controlledCopyNumber}}", "<p>Dear {{recipientName}},</p><p>The controlled copy <b>{{controlledCopyNumber}}</b> of <b>{{documentNumber}} - {{documentTitle}}</b> (revision {{revisionNumber}}) has been <b>destroyed</b> and its destruction recorded.</p><p>Do not use any printed or electronic copy that carries this number. The record of the destruction is kept in the Audit Trail.</p>"}),
            java.util.Map.entry("controlled_copy.distributed", new String[]{"[EQMS] Controlled copy available: {{documentNumber}}", "<p>Dear {{recipientName}},</p><p>A new controlled copy is available for you: <b>{{documentNumber}} - {{documentTitle}}</b> (revision {{revisionNumber}}), copy number <b>{{controlledCopyNumber}}</b>.</p><p>It is valid until <b>{{expiryDateDisplay}}</b>. Use only this copy for work; it is void when the document is replaced or expires.</p>"}),
            java.util.Map.entry("document.published", new String[]{"[EQMS] Document is now effective: {{documentNumber}}", "<p>Dear {{recipientName}},</p><p>The document <b>{{documentNumber}} - {{documentTitle}}</b>, revision <b>{{revisionNumber}}</b>, has been published and is now <b>Effective</b>.</p><p>From now on this is the version to use. Printed copies of the previous revision must not be used.</p>"}),
            java.util.Map.entry("document.review_completed", new String[]{"[EQMS] Review completed: {{documentNumber}}", "<p>Dear {{recipientName}},</p><p>All reviewers have <b>completed their review</b> of <b>{{documentNumber}} - {{documentTitle}}</b> (revision {{revisionNumber}}).</p><p>The revision is ready for the next step (approval).</p>"}),
            java.util.Map.entry("knowledge.document_published", new String[]{"[EQMS] New in {{knowledgeBase}}: {{documentNumber}}", "<p>Dear {{recipientName}},</p><p>A new document was published in the Knowledge Base <b>{{knowledgeBase}}</b> that you follow: <b>{{documentNumber}} - {{documentTitle}}</b> (revision {{revisionNumber}}), now <b>Effective</b>.</p>"}),
            java.util.Map.entry("system.maintenance_scheduled", new String[]{"[EQMS] {{title}}", "<p>Dear {{recipientName}},</p><p>{{message}}</p><p>Finish and save your work before the maintenance window starts. During the window the system is not available.</p>"}),
            java.util.Map.entry("training.content_rejected", new String[]{"[EQMS] {{title}}", "<p>Dear {{recipientName}},</p><p>{{message}}</p><p>The training returns to <b>Planned</b>: change the content and send it for approval again.</p>"}),
            java.util.Map.entry("training.session_changed", new String[]{"[EQMS] {{title}}", "<p>Dear {{recipientName}},</p><p>{{message}}</p><p>The people concerned were told by e-mail about the change.</p>"})
    );

    /** The e-mail of an event: its own wording, or for a Training notice the title and text the module composes. */
    private static String[] emailContent(EventSeed seed) {
        if (FULL_EMAIL_CONTENT.containsKey(seed.code())) return FULL_EMAIL_CONTENT.get(seed.code());
        if (ACCOUNT_EMAIL_CONTENT.containsKey(seed.code())) return ACCOUNT_EMAIL_CONTENT.get(seed.code());
        if (REPORT_TEMPLATE_REJECTED.equals(seed.code())) return new String[]{"[EQMS] Report Template Rejected: {{entityName}}",
                "<p>The report template <b>{{entityName}}</b> was rejected by {{actorName}}.</p><p><b>Reason:</b> {{actionComment}}</p><p>Change the template and submit it again: {{actionUrl}}</p>"};
        if (TRAINING_SESSION_EMAIL.containsKey(seed.code())) return TRAINING_SESSION_EMAIL.get(seed.code());
        if (EMAIL_CONTENT.containsKey(seed.code())) return EMAIL_CONTENT.get(seed.code());
        if (seed.variables().startsWith(AUDIT_VARS)) return new String[]{"[EQMS] " + seed.name(), "<p>" + AUDIT_SUMMARY + "</p>"};
        return seed.variables().startsWith(PASS_THROUGH_VARS) ? new String[]{"[EQMS] {{title}}", "<p>{{message}}</p>"} : null;
    }

    /** The in-app wording of an event that started from an e-mail message: one short sentence. The long text stays in the e-mail; a notice of 400 characters is not an in-app notice. */
    private static final java.util.Map<String, String> SHORT_IN_APP = java.util.Map.ofEntries(
            java.util.Map.entry("controlled_copy.cancel_notice", "Controlled copy {{controlledCopyNumber}} ({{documentTitle}}, revision {{revisionNumber}}) was cancelled and must no longer be used."),
            java.util.Map.entry("controlled_copy.notice", "Controlled copy {{controlledCopyNumber}}: {{workflowAction}}."),
            java.util.Map.entry("controlled_copy.distribution_notice", "A new controlled copy is available: {{controlledCopyNumber}} ({{documentTitle}}, revision {{revisionNumber}})."),
            java.util.Map.entry("controlled_copy.expiry_notice", "Controlled copy {{controlledCopyNumber}} ({{documentTitle}}) expires on {{expiryDate}}."),
            java.util.Map.entry("controlled_copy.obsoleted_notice", "Controlled copy {{controlledCopyNumber}} is obsolete: its document was replaced. Stop using it."),
            java.util.Map.entry("controlled_copy.recall_notice", "Controlled copy {{controlledCopyNumber}} ({{documentTitle}}) was recalled. Return it as instructed."),
            java.util.Map.entry("document.approval_request", "{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) is ready for your approval."),
            java.util.Map.entry("document.review_request", "{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) is waiting for your review."),
            java.util.Map.entry("document.edit_online", "You can edit {{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) online."),
            java.util.Map.entry("document.publish_notice", "{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) was published."),
            java.util.Map.entry("document.ready_for_publishing", "{{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}}) is ready for publishing."),
            java.util.Map.entry("document.ready_for_submission", "{{documentNumber}} - {{documentTitle}}: the author finished editing; it is ready for your review."),
            java.util.Map.entry("document.training_required", "Training has been assigned for {{documentNumber}} - {{documentTitle}} (revision {{revisionNumber}})."),
            java.util.Map.entry("knowledge.share_notice", "{{actorName}}: {{actionTitle}} - {{itemLabel}}.")
    );

    /**
     * The registry event of each notice that is still raised as an e-mail message type is created from the active message of the type (its title as the
     * in-app title, the start of its text as the in-app message, its subject and text as the e-mail), once. An event that exists is not touched: the
     * administrator owns its wording from then on. A type without an active message gets no event until it has one.
     */
    private void seedLegacyMessageEvents() {
        if (emailTemplateRepository == null) return;
        int order = 1000;
        for (com.eqms.service.LegacyMessageEvents.Event legacy : com.eqms.service.LegacyMessageEvents.all()) {
            order += 10;
            if (policyRepository.existsByEventCode(legacy.code())) continue;
            com.eqms.entity.EmailTemplate template = emailTemplateRepository
                    .findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(legacy.messageType(), "Active").orElse(null);
            if (template == null) continue;
            java.util.LinkedHashSet<String> names = new java.util.LinkedHashSet<>(java.util.List.of("recipientName", "actionUrl", "systemName"));
            if (template.getVariablesList() != null) template.getVariablesList().stream().filter(v -> v != null && !v.isBlank()).map(String::trim).forEach(names::add);
            String variables = String.join(",", names);

            NotificationEventDefinition event = eventRepository.findByCode(legacy.code()).orElseGet(NotificationEventDefinition::new);
            event.setCode(legacy.code());
            event.setName(legacy.name());
            event.setDescription("Raised by the module as the e-mail message \"" + template.getName() + "\". Its in-app wording and its e-mail wording started from that message and are edited separately.");
            event.setModule(legacy.module());
            event.setPriority(legacy.priority());
            event.setRelatedAction("NOTIFY");
            event.setDataObject(legacy.module());
            event.setSupportedChannels("IN_APP,EMAIL");
            event.setAvailableVariables(variables);
            event.setActive(true);
            event.setDisplayOrder(order);
            eventRepository.save(event);

            NotificationPolicy policy = new NotificationPolicy();
            policy.setEventCode(legacy.code());
            policy.setStatus(NotificationPolicy.STATUS_ACTIVE);
            policy.setEnabledChannels(com.eqms.service.NotificationDefaultChannels.of(legacy.code(), "IN_APP,EMAIL"));
            policy.setRecipientRules(buildDefaultRecipientRules(new String[]{"RECIPIENT"}));
            policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
            policy.setEscalationEnabled(false);
            policy.setEscalationRecipientRules(objectMapper.createArrayNode());
            policy = policyRepository.save(policy);

            // the e-mail messages of the older senders were rendered with {name} as well as {{name}}; the registry writes {{name}}
            String title = doubleBraces(template.getSubject() == null ? legacy.name() : template.getSubject());
            String content = doubleBraces(template.getContent());
            NotificationTemplateVersion inApp = buildVersion(policy, NotificationTemplateVersion.CHANNEL_IN_APP, clip(title, 255), SHORT_IN_APP.getOrDefault(legacy.code(), clip(plainText(content), 480)), variables);
            inApp.setChangeSummary("Created from the e-mail message " + template.getName());
            templateVersionRepository.save(inApp);
            NotificationTemplateVersion email = buildVersion(policy, NotificationTemplateVersion.CHANNEL_EMAIL, null, null, variables);
            email.setSubject(clip(title, 255));
            email.setBody(content);
            email.setActionLabel("Open in EQMS");
            email.setChangeSummary("Created from the e-mail message " + template.getName());
            templateVersionRepository.save(email);
        }
    }

    private static String doubleBraces(String text) {
        return text == null ? null : text.replaceAll("(^|[^{])\\{([A-Za-z0-9_]+)\\}(?!\\})", "$1{{$2}}");
    }

    private static String plainText(String html) {
        if (html == null) return "";
        return html.replaceAll("(?s)<[^>]*>", " ").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
    }

    private static String clip(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max - 3) + "...";
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

    /** The wording of the account e-mails (they started from the e-mail messages of the same name, which are kept for older callers). */
    private static final java.util.Map<String, String[]> ACCOUNT_EMAIL_CONTENT = java.util.Map.of(
            com.eqms.service.NotificationMandatoryEvents.MFA_LOGIN_CODE, new String[]{
                    "Your EQMS verification code: {{otpCode}}",
                    "<p>Hello {{recipientName}},</p><p>Your verification code is: <strong>{{otpCode}}</strong></p><p>This code will expire in {{expiresIn}} minutes.</p><p>If you did not request this code, please ignore this email.</p>"
            },
            com.eqms.service.NotificationMandatoryEvents.PASSWORD_RESET_LINK, new String[]{
                    "EQMS password reset request",
                    "<p>Hello {{recipientName}},</p><p>You requested a password reset. Please click the link below to set a new password:</p><p><a href=\"{{resetLink}}\">{{resetLink}}</a></p><p>This link is valid for 24 hours.</p><p>If you did not request a password reset, please ignore this email.</p>"
            },
            com.eqms.service.NotificationMandatoryEvents.ACCOUNT_UNLOCKED, new String[]{
                    "Your EQMS account has been unlocked",
                    "<p>Hello {{recipientName}},</p><p>Your EQMS account was locked after too many failed login attempts. An administrator has unlocked it and issued a new temporary password.</p><p><strong>Username:</strong> {{username}}<br/><strong>Temporary password:</strong> {{tempPassword}}</p><p><a href=\"{{loginLink}}\">Click here to sign in</a></p><p>For security, you will be required to set a new password immediately after signing in. If you did not expect this, please contact your system administrator right away.</p>"
            },
            com.eqms.service.NotificationMandatoryEvents.ACCOUNT_PASSWORD_RESET, new String[]{
                    "Your EQMS password has been reset",
                    "<p>Hello {{recipientName}},</p><p>An administrator has reset your EQMS password and issued a new temporary password.</p><p><strong>Username:</strong> {{username}}<br/><strong>Temporary password:</strong> {{tempPassword}}</p><p><a href=\"{{loginLink}}\">Click here to sign in</a></p><p>For security, you will be required to set a new password immediately after signing in. If you did not expect this, please contact your system administrator right away.</p>"
            },
            com.eqms.service.NotificationMandatoryEvents.MFA_REQUIREMENT_REMOVED, new String[]{
                    "Multifactor authentication is no longer required for your EQMS account",
                    "<p>Hello {{recipientName}},</p><p>An administrator no longer requires multi-factor authentication for your EQMS account. You can keep using it, or switch it off in your profile settings.</p><p>If you did not expect this change, please contact your system administrator.</p>"
            },
            com.eqms.service.NotificationMandatoryEvents.ACCOUNT_MFA_RESET, new String[]{
                    "Your EQMS multi-factor authentication was reset",
                    "<p>Hello {{recipientName}},</p><p>An administrator has reset the multi-factor authentication of your EQMS account, so that you can set it up again. All your sessions were signed out.</p><p>The next time you sign in you will be asked to set up multi-factor authentication again.</p><p>If you did not ask for this, contact your administrator at once.</p>"
            });

    /** Email subject and body (HTML) per event code. Index 0 = subject, 1 = body. English only. */
    private static final java.util.Map<String, String[]> EMAIL_CONTENT = java.util.Map.of(
            "document.expired", new String[]{
                    "[EQMS] Document expired: {{documentNumber}}",
                    "<p><b>Document {{documentNumber}} — {{documentTitle}} has passed its Valid Until date and is no longer valid.</b></p>"
                    + "<p>Its electronic copies have been voided. Do not use this document, including any printed copy, and do not request new copies until the document has been reviewed and extended or replaced by a newer version.</p>"
                    + "<p>Link: {{actionUrl}}</p>"
            },
            "document.expired_copy_holder", new String[]{
                    "[EQMS] Your copy is void: {{documentNumber}}",
                    "<p><b>The controlled copy you hold of {{documentNumber}} — {{documentTitle}} is void because the document has expired.</b></p>"
                    + "<p>Do not use the electronic copy or the printed copy issued to you. Document Control (DCO) will recall your printed copy.</p>"
                    + "<p>Link: {{actionUrl}}</p>"
            },
            // NOTIFICATION-REVIEW-2026-11-21: the person is told what happened to their account. Never a password or a sign-in detail.
            "user.account_created", new String[]{
                    "[EQMS] An account was created for you",
                    "<p>An account was created for you in {{systemName}}.</p><p>Sign in with the details your administrator gave you. You will be asked to choose a new password the first time.</p>"
            },
            "user.account_reinstated", new String[]{
                    "[EQMS] Your account was reinstated",
                    "<p>Your {{systemName}} account was reinstated. You can sign in again.</p>"
            },
            "user.time_limited_access_changed", new String[]{
                    "[EQMS] Your time-limited access changed",
                    "<p>{{actionName}}.</p><p>{{actionComment}}</p>"
            },
            "user.time_limited_access_expiring", new String[]{
                    "[EQMS] Your access ends soon",
                    "<p>Your time-limited access ends on {{endDate}}; after that your account will be suspended. Ask your administrator if you need it longer.</p>"
            },
            "user.access_profile_changed", new String[]{
                    "[EQMS] Your access changed",
                    "<p>Your access profile <b>{{profileName}}</b> was {{changeType}}.</p><p>What you may do in {{systemName}} may have changed.</p>"
            });

    private static final String STD_VARS = "recipientName,documentNumber,documentTitle,revisionNumber,actionUrl,systemName";

    /** The events whose module composes the title and the text and hands them over as they are. */
    /** The placeholders of the notices about a session of a training (owner decision 2026-11-24): the wording an administrator edits can use them. */
    private static final String TRAINING_SESSION_VARS = ",sessionNo,sessionTopic,sessionDate,oldDate,newDate,venue,trainerName,previousTrainerName,newTrainerName,reason,changedBy";

    /** The e-mail of the notices about a session: the whole information, for a person who is not in the system at that time. The in-app notice of these events is off by default. */
    private static final java.util.Map<String, String[]> TRAINING_SESSION_EMAIL = java.util.Map.of(
            "training.postponed", new String[]{
                    "[EQMS] Training session postponed: {{trainingNumber}}, Session {{sessionNo}}",
                    "<p>Dear {{recipientName}},</p>"
                    + "<p>Session {{sessionNo}} of the training <b>{{trainingNumber}}</b> ({{sessionTopic}}) has been <b>postponed</b>.</p>"
                    + "<p><b>Previous day:</b> {{oldDate}}<br/><b>New day:</b> {{newDate}}<br/><b>Place:</b> {{venue}}<br/><b>Trainer:</b> {{trainerName}}</p>"
                    + "<p><b>Reason:</b> {{reason}}</p><p>Please note the new day. This message replaces the day you were told before. Changed by {{changedBy}}.</p><p>Details: {{actionUrl}}</p>"},
            "training.session_cancelled", new String[]{
                    "[EQMS] Training session cancelled: {{trainingNumber}}, Session {{sessionNo}}",
                    "<p>Dear {{recipientName}},</p>"
                    + "<p>Session {{sessionNo}} of the training <b>{{trainingNumber}}</b> ({{sessionTopic}}) has been <b>cancelled</b>. You do not need to attend or conduct it.</p>"
                    + "<p><b>Day it was planned for:</b> {{sessionDate}}<br/><b>Place:</b> {{venue}}</p>"
                    + "<p><b>Reason:</b> {{reason}}</p><p>Cancelled by {{changedBy}}.</p><p>Details: {{actionUrl}}</p>"},
            "training.trainer_assigned", new String[]{
                    "[EQMS] You are the trainer: {{trainingNumber}}, Session {{sessionNo}}",
                    "<p>Dear {{recipientName}},</p>"
                    + "<p>You are the <b>trainer</b> of Session {{sessionNo}} of the training <b>{{trainingNumber}}</b> ({{sessionTopic}}).</p>"
                    + "<p><b>Day:</b> {{sessionDate}}<br/><b>Place:</b> {{venue}}<br/><b>In place of:</b> {{previousTrainerName}}</p>"
                    + "<p>You are asked to conduct the session on that day and in that place. Assigned by {{changedBy}}.</p><p>Details: {{actionUrl}}</p>"},
            "training.trainer_removed", new String[]{
                    "[EQMS] You are no longer the trainer: {{trainingNumber}}, Session {{sessionNo}}",
                    "<p>Dear {{recipientName}},</p>"
                    + "<p>You are <b>no longer the trainer</b> of Session {{sessionNo}} of the training <b>{{trainingNumber}}</b> ({{sessionTopic}}). Nothing is asked of you for this session.</p>"
                    + "<p><b>Day:</b> {{sessionDate}}<br/><b>Place:</b> {{venue}}<br/><b>New trainer:</b> {{newTrainerName}}</p>"
                    + "<p>Changed by {{changedBy}}.</p><p>Details: {{actionUrl}}</p>"});

    private static final String PASS_THROUGH_VARS = "recipientName,title,message,actionUrl,systemName";
    /** What the Audit Trail raises says, in its own words: what was done, to which record, by whom, with which comment (the wording an administrator edits). */
    static final String AUDIT_SUMMARY = "{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}";
    /** REPORT-TEMPLATE-REJECT-NOTICE-2026-11-15: the author is told which template was rejected, by whom, and the reason in so many words (migration V790 does the same for a database that has the event). */
    static final String REPORT_TEMPLATE_REJECTED = "report.template_rejected";
    /** In-app title and message of the audit-driven events that are written for the person they concern (index 0 title, 1 message). */
    private static final java.util.Map<String, String[]> AUDIT_WORDING = java.util.Map.of(
            "user.account_created", new String[]{"Your account was created", "An account was created for you in {{systemName}}. Sign in with the details your administrator gave you."},
            "user.account_reinstated", new String[]{"Your account was reinstated", "Your {{systemName}} account was reinstated. You can sign in again."},
            "user.time_limited_access_changed", new String[]{"Your time-limited access changed", "{{actionName}}. {{actionComment}}"});
    static final String REPORT_TEMPLATE_REJECTED_SUMMARY = "{{entityName}} was rejected by {{actorName}}. Reason: {{actionComment}}";
    private static final String AUDIT_VARS = PASS_THROUGH_VARS + ",actorName,entityName,actionComment,actionName";

    /** The registry events of the modules and the notices of Training Management. */
    private List<EventSeed> catalog() {
        List<EventSeed> all = new java.util.ArrayList<>(coreCatalog());
        for (com.eqms.service.training.TrainingNotificationEvents.Event event : com.eqms.service.training.TrainingNotificationEvents.all()) {
            all.add(new EventSeed(event.registryCode(), event.name(), event.description(), "TRAINING", event.priority(),
                    "NOTIFY", "TRAINING", event.channels(), PASS_THROUGH_VARS + ",actorName,trainingNumber,documentNumber,trainingDueDate,requestNumber" + (TRAINING_SESSION_EMAIL.containsKey(event.registryCode()) ? TRAINING_SESSION_VARS : ""),
                    new String[]{"RECIPIENT"}, "{{title}}", "{{message}}"));
        }
        for (com.eqms.service.OperationalNotificationEvents.Event event : com.eqms.service.OperationalNotificationEvents.all()) {
            // the holder the module names, and for a recall that was not followed up also the people who run recalls
            ArrayNode rules = objectMapper.createArrayNode();
            rules.addObject().put("type", "RECIPIENT");
            if (com.eqms.service.OperationalNotificationEvents.RECALL_OVERDUE.equals(event.code())) {
                rules.addObject().put("type", "PERMISSION").put("value", "documents.controlled_copy.recall");
            }
            all.add(new EventSeed(event.code(), event.name(), event.description(), event.module(), event.priority(),
                    "NOTIFY", event.module(), event.channels(), PASS_THROUGH_VARS, new String[]{"RECIPIENT"}, "{{title}}", "{{message}}", rules, null));
        }
        for (com.eqms.service.AuditNotificationEvents.Event event : com.eqms.service.AuditNotificationEvents.all()) {
            ArrayNode rules = objectMapper.createArrayNode();
            for (com.eqms.service.AuditNotificationEvents.Rule rule : event.rules()) {
                var node = rules.addObject().put("type", rule.type());
                if (rule.value() != null) node.put("value", rule.value());
            }
            // the channel an event is sent on by default is in-app; an administrator turns the e-mail on
            all.add(new EventSeed(event.code(), event.name(), event.description(), event.module(), event.priority(), "NOTIFY", event.module(), "IN_APP",
                    // the wording of a campaign event says {{campaignName}} (the bridge gives the name of the audited record under that name too)
                    event.code().contains("campaign") ? AUDIT_VARS + ",campaignName" : AUDIT_VARS, new String[]{}, AUDIT_WORDING.containsKey(event.code()) ? AUDIT_WORDING.get(event.code())[0] : event.name(),
                    AUDIT_WORDING.containsKey(event.code()) ? AUDIT_WORDING.get(event.code())[1] : REPORT_TEMPLATE_REJECTED.equals(event.code()) ? REPORT_TEMPLATE_REJECTED_SUMMARY : AUDIT_SUMMARY, rules, event.defaultStatus()));
        }
        return all;
    }

    private List<EventSeed> coreCatalog() {
        return List.of(
                // ── Document Control ────────────────────────────────────────────
                new EventSeed(
                        "document.submitted_for_review", "Document Submitted for Review",
                        "A document draft has been submitted and is awaiting reviewer action.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "SUBMIT_FOR_REVIEW", "DOCUMENT_REVISION", "IN_APP", STD_VARS,
                        new String[]{"REVIEWER"},
                        "Document ready for review", "{{documentNumber}} — {{documentTitle}} is awaiting your review."
                ),
                new EventSeed(
                        "document.review_completed", "Document Review Completed",
                        "All reviewers have completed their review of a document revision.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "REVIEW_COMPLETE", "DOCUMENT_REVISION", "IN_APP", STD_VARS,
                        new String[]{"AUTHOR", "APPROVER"},
                        "Review completed", "{{documentNumber}} — {{documentTitle}} review is complete and ready for approval."
                ),
                new EventSeed(
                        "document.review_rejected", "Document Review Rejected",
                        "A Reviewer rejected the revision; it is back in Draft.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "REVIEW_REJECT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",actorName,workflowComment",
                        new String[]{"AUTHOR", "REVIEWER"},
                        "Review rejected", "{{documentNumber}} — {{documentTitle}} was rejected in review by {{actorName}}: {{workflowComment}}"
                ),
                new EventSeed(
                        "document.approval_rejected", "Document Approval Rejected",
                        "The Approver rejected the revision; it is back in Draft.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "APPROVE_REJECT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",actorName,workflowComment",
                        new String[]{"AUTHOR", "REVIEWER"},
                        "Approval rejected", "{{documentNumber}} — {{documentTitle}} was rejected at approval by {{actorName}}: {{workflowComment}}"
                ),
                new EventSeed(
                        "document.approved", "Document Approved",
                        "A document revision has been approved by all approvers.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "APPROVE_COMPLETE", "DOCUMENT_REVISION", "IN_APP", STD_VARS,
                        new String[]{"AUTHOR", "OWNER"},
                        "Document approved", "{{documentNumber}} — {{documentTitle}} has been approved."
                ),
                new EventSeed(
                        "document.training_completed", "Revision Training Completed",
                        "The training of a revision was confirmed as completed; the revision is Ready for Publishing. Told in-app to Document Control (the e-mail is Document Ready for Publishing).",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "TRAINING_COMPLETE", "DOCUMENT_REVISION", "IN_APP", STD_VARS,
                        new String[]{"RECIPIENT"},
                        "Training completed", "{{documentNumber}} — {{documentTitle}} (Rev {{revisionNumber}}): the training is completed. The revision is ready for publishing."
                ),
                new EventSeed(
                        "knowledge.document_published", "Knowledge Document Published",
                        "A new Effective document was published in a Knowledge Base the user subscribed to.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_LOW,
                        "PUBLISH", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",knowledgeBase",
                        new String[]{"RECIPIENT"},
                        "New in {{knowledgeBase}}", "{{documentNumber}} — {{documentTitle}} (Rev {{revisionNumber}}) is now Effective."
                ),
                new EventSeed(
                        "document.upgrade_ready", "Document Ready for Upgrade",
                        "The DCO configured the next revision of an Active document; its Author may now upload the new revision.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "CONFIGURE_NEXT_REVISION", "DOCUMENT", "IN_APP", STD_VARS,
                        new String[]{"AUTHOR"},
                        "Document ready for upgrade", "{{documentNumber}} — {{documentTitle}} has been configured for upgrade. You can now upload the new revision."
                ),
                new EventSeed(
                        "document.participant_unavailable", "Workflow Assignee Unavailable",
                        "A Reviewer or Approver with a pending action was suspended or terminated; the assignment must be replaced.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "REPLACE_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,fullName",
                        new String[]{"RECIPIENT"},
                        "Workflow assignee unavailable",
                        "{{documentNumber}} — {{documentTitle}}: the pending {{participantType}} {{fullName}} is no longer available. Replace the assignment so the revision can continue."
                ),
                new EventSeed(
                        "document.action_reminder", "Pending Review/Approval Reminder",
                        "A Reviewer or Approver has had a revision waiting for their action for longer than the configured reminder period.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "REMIND_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,daysPending",
                        new String[]{"RECIPIENT"},
                        "Action pending",
                        "{{documentNumber}} — {{documentTitle}} has been waiting for your {{participantType}} action for {{daysPending}} day(s)."
                ),
                new EventSeed(
                        "document.action_escalated", "Pending Review/Approval Escalation",
                        "A revision has been waiting on a Reviewer or Approver for longer than the configured escalation period.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "ESCALATE_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,fullName,daysPending",
                        new String[]{"RECIPIENT"},
                        "Revision stuck in workflow",
                        "{{documentNumber}} — {{documentTitle}} has been waiting for {{participantType}} {{fullName}} for {{daysPending}} day(s)."
                ),
                new EventSeed(
                        "document.published", "Document Published (Effective)",
                        "A document revision has been published and is now the effective version.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "PUBLISH", "DOCUMENT_REVISION", "IN_APP", STD_VARS,
                        new String[]{"AUTHOR", "REVIEWER", "APPROVER"},
                        "Document is now effective", "{{documentNumber}} — {{documentTitle}} (Rev {{revisionNumber}}) is now Effective."
                ),
                new EventSeed(
                        // TBR-DOC-016: Document Obsolete notification. It always
                        // fires for Author + the
                        // permission-equivalent DCO/Coordinator audience; Distributed-copy recipients
                        // affected by the cascade are added as explicit recipients at dispatch time
                        // (see DocumentObsoleteNotificationService), not via defaultRecipientRoles.
                        "document.obsoleted", "Document Obsoleted",
                        "A document master record has been obsoleted.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "OBSOLETE", "DOCUMENT", "IN_APP", STD_VARS,
                        new String[]{"AUTHOR", "OWNER"},
                        "Document obsoleted", "{{documentNumber}} — {{documentTitle}} has been obsoleted."
                ),
                new EventSeed(
                        // Owner decision DOCUMENT-EXPIRY-2026-10-16: every Active user is told when a document passes its
                        // Valid Until day. Sent by DocumentExpiryNotifier, not by a
                        // recipient rule of its own: the people it passes are the audience (every Active account), so the rule is RECIPIENT (V840; an empty rule reached nobody).
                        "document.expired", "Document Expired",
                        "An Active document has reached its Valid Until date. Its controlled copies are voided and no copy can be requested.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "EXPIRE", "DOCUMENT", "IN_APP,EMAIL", STD_VARS,
                        new String[]{"RECIPIENT"},
                        "Document expired", "{{documentNumber}} — {{documentTitle}} has passed its Valid Until date. Do not use it."
                ),
                new EventSeed(
                        "document.expired_copy_holder", "Document Expired (Copy Holder)",
                        "Sent to the holders of controlled copies that were voided because the document expired.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "EXPIRE", "DOCUMENT", "IN_APP,EMAIL", STD_VARS,
                        new String[]{"RECIPIENT"},
                        "Your copy is void", "{{documentNumber}} — {{documentTitle}} has expired. Your copy is void. Do not use it; the DCO will recall the paper copy."
                ),
                new EventSeed(
                        "document.periodic_review_due", "Document Periodic Review Due",
                        "A published document is approaching its periodic review date.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "REVIEW_DUE", "DOCUMENT", "IN_APP", STD_VARS + ",reviewDate,reviewStatus",
                        new String[]{"OWNER", "AFFECTED_USERS"},
                        "Periodic review due", "{{documentNumber}} — {{documentTitle}} {{reviewStatus}} {{reviewDate}}."
                ),

                // ── Controlled Copies ───────────────────────────────────────────
                new EventSeed(
                        "controlled_copy.distributed", "Controlled Copy Distributed",
                        "A controlled copy has been issued/distributed to a recipient.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_HIGH,
                        "DISTRIBUTE", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber,expiryDateDisplay",
                        new String[]{"RECIPIENT"},
                        "Controlled copy available", "A new controlled copy is available: {{documentTitle}}."
                ),
                new EventSeed(
                        "controlled_copy.recalled", "Controlled Copy Recalled",
                        "A controlled copy has been recalled and must no longer be used.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_CRITICAL,
                        "RECALL", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber,recallReason",
                        new String[]{"RECIPIENT"},
                        "Controlled copy recalled", "{{controlledCopyNumber}} has been recalled. Reason: {{recallReason}}."
                ),
new EventSeed(
                        "controlled_copy.destroyed", "Controlled Copy Destroyed",
                        "A controlled copy has been destroyed and its destruction recorded.",
                        "CONTROLLED_COPIES", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "DESTROY", "CONTROLLED_COPY", "IN_APP", STD_VARS + ",controlledCopyNumber",
                        new String[]{"RECIPIENT", "OWNER"},
                        "Controlled copy destroyed", "{{controlledCopyNumber}} has been destroyed."
                ),

                // ── Audit Trail ──────────────────────────────────────────────────
// ── Security ─────────────────────────────────────────────────────
                new EventSeed(
                        "security.password_changed", "Password Changed",
                        "A user's password has been changed.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "CHANGE_PASSWORD", "USER_ACCOUNT", "IN_APP", STD_VARS,
                        new String[]{"OWNER"},
                        "Password changed", "Your password was recently changed."
                ),
                new EventSeed(
                        "security.mfa_updated", "MFA Settings Updated",
                        "A user's multi-factor authentication settings have changed.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "UPDATE_MFA", "USER_ACCOUNT", "IN_APP", STD_VARS,
                        new String[]{"OWNER"},
                        "MFA settings updated", "Your multi-factor authentication settings were updated."
                ),
new EventSeed(
                        "security.account_locked", "Account Locked",
                        "A user account has been locked after repeated failed sign-in attempts.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH,
                        "LOCK_ACCOUNT", "USER_ACCOUNT", "IN_APP", STD_VARS,
                        new String[]{"OWNER"},
                        "Account locked", "Your account has been locked due to repeated failed sign-in attempts."
                ),
                new EventSeed(
                        "user.time_limited_access_expired", "Time-Limited User Access Expired",
                        "A \"Time-Limited User\" grant window has ended and the account was automatically suspended.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "TIME_LIMITED_EXPIRE", "USER_ACCOUNT", "IN_APP", "recipientName,endDate,actionUrl,systemName",
                        new String[]{"OWNER"},
                        "Your access has expired", "Your time-limited access ended on {{endDate}} and your account has been suspended."
                ),
                new EventSeed(
                        "user.time_limited_access_expiring", "Time-Limited User Access Ending Soon",
                        "A \"Time-Limited User\" grant window ends in a few days; the person is told before the account is suspended.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "TIME_LIMITED_EXPIRING", "USER_ACCOUNT", "IN_APP", "recipientName,endDate,actionUrl,systemName",
                        new String[]{"OWNER"},
                        "Your access ends soon", "Your time-limited access ends on {{endDate}}; after that your account will be suspended."
                ),
                new EventSeed(
                        "user.access_profile_changed", "Your Access Profile Changed",
                        "An Access Profile was assigned to the person or removed from them. The person is told; nothing else about the change is in the notice.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "ACCESS_PROFILE_CHANGED", "USER_ACCOUNT", "IN_APP", "recipientName,profileName,changeType,actionUrl,systemName",
                        new String[]{"AFFECTED_USERS"},
                        "Your access changed", "Your access profile {{profileName}} was {{changeType}}."
                ),
                // Account e-mails that carry a secret or that the person cannot do without: e-mail only, always sent (NotificationMandatoryEvents)
                new EventSeed(
                        com.eqms.service.NotificationMandatoryEvents.MFA_LOGIN_CODE, "MFA Sign-in Code",
                        "The one-time code sent by e-mail to sign in, or to set up multi-factor authentication. E-mail only and always sent: it carries a secret and cannot be switched off.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH,
                        "MFA_LOGIN_CODE", "USER_ACCOUNT", "EMAIL", "recipientName,systemName,otpCode,expiresIn",
                        new String[]{"AFFECTED_USERS"},
                        "MFA sign-in code", "Your verification code is {{otpCode}}."
                ),
                new EventSeed(
                        com.eqms.service.NotificationMandatoryEvents.PASSWORD_RESET_LINK, "Password Reset Link",
                        "The link to set a new password, sent when a user asks to reset it. E-mail only and always sent: it carries a secret and cannot be switched off.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH,
                        "REQUEST_PASSWORD_RESET", "USER_ACCOUNT", "EMAIL", "recipientName,systemName,resetLink",
                        new String[]{"AFFECTED_USERS"},
                        "Password reset link", "Use the link to set a new password."
                ),
                new EventSeed(
                        com.eqms.service.NotificationMandatoryEvents.ACCOUNT_UNLOCKED, "Account Unlocked - Temporary Password",
                        "Sent when an administrator unlocks an account: the user name, the temporary password and the address to sign in. E-mail only and always sent: it carries a secret and cannot be switched off.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH,
                        "UNLOCK_ACCOUNT", "USER_ACCOUNT", "EMAIL", "recipientName,systemName,username,tempPassword,loginLink",
                        new String[]{"AFFECTED_USERS"},
                        "Account unlocked", "Your account was unlocked and has a temporary password."
                ),
                new EventSeed(
                        com.eqms.service.NotificationMandatoryEvents.ACCOUNT_PASSWORD_RESET, "Password Reset - Temporary Password",
                        "Sent when an administrator resets a password: the user name, the temporary password and the address to sign in. E-mail only and always sent: it carries a secret and cannot be switched off.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH,
                        "RESET_PASSWORD", "USER_ACCOUNT", "EMAIL", "recipientName,systemName,username,tempPassword,loginLink",
                        new String[]{"AFFECTED_USERS"},
                        "Password reset", "Your password was reset and has a temporary password."
                ),
                new EventSeed(
                        com.eqms.service.NotificationMandatoryEvents.MFA_REQUIREMENT_REMOVED, "MFA No Longer Required",
                        "Sent when an administrator stops requiring multi-factor authentication for a user who had already set it up. E-mail only and always sent.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "UPDATE_MFA", "USER_ACCOUNT", "EMAIL", "recipientName,systemName",
                        new String[]{"AFFECTED_USERS"},
                        "MFA no longer required", "An administrator no longer requires multi-factor authentication for your account."
                ),
                new EventSeed(
                        com.eqms.service.NotificationMandatoryEvents.ACCOUNT_MFA_RESET, "MFA Reset By Administrator",
                        "Sent when an administrator resets the multi-factor authentication of a user (lost device). The user enrols again at the next sign-in. E-mail only and always sent: it is a security notice the person must get.",
                        "SECURITY", NotificationEventDefinition.PRIORITY_HIGH,
                        "RESET_MFA", "USER_ACCOUNT", "EMAIL", "recipientName,systemName",
                        new String[]{"AFFECTED_USERS"},
                        "MFA reset", "An administrator reset the multi-factor authentication of your account."
                ),

                // ── System ───────────────────────────────────────────────────────
new EventSeed(
                        "system.maintenance_scheduled", "System Maintenance Scheduled",
                        "A system maintenance window has been scheduled.",
                        "SYSTEM", NotificationEventDefinition.PRIORITY_MEDIUM,
                        "SCHEDULE_MAINTENANCE", "SYSTEM", "IN_APP", PASS_THROUGH_VARS,
                        new String[]{"ALL_USERS"},
                        "{{title}}", "{{message}}"
                )
        );
    }
}
