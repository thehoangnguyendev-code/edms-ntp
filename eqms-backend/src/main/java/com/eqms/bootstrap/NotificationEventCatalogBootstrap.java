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

    /** The e-mail of an event: its own wording, or for a Training notice the title and text the module composes. */
    private static String[] emailContent(EventSeed seed) {
        if (ACCOUNT_EMAIL_CONTENT.containsKey(seed.code())) return ACCOUNT_EMAIL_CONTENT.get(seed.code());
        if (REPORT_TEMPLATE_REJECTED.equals(seed.code())) return new String[]{"[EQMS] Report Template Rejected: {{entityName}}",
                "<p>The report template <b>{{entityName}}</b> was rejected by {{actorName}}.</p><p><b>Reason:</b> {{actionComment}}</p><p>Change the template and submit it again: {{actionUrl}}</p>"};
        if (EMAIL_CONTENT.containsKey(seed.code())) return EMAIL_CONTENT.get(seed.code());
        if (AUDIT_VARS.equals(seed.variables())) return new String[]{"[EQMS] " + seed.name(), "<p>" + AUDIT_SUMMARY + "</p>"};
        return seed.variables().startsWith(PASS_THROUGH_VARS) ? new String[]{"[EQMS] {{title}}", "<p>{{message}}</p>"} : null;
    }

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
            NotificationTemplateVersion inApp = buildVersion(policy, NotificationTemplateVersion.CHANNEL_IN_APP, clip(title, 255), clip(plainText(content), 480), variables);
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
            });

    private static final String STD_VARS = "recipientName,documentNumber,documentTitle,revisionNumber,actionUrl,systemName";

    /** The events whose module composes the title and the text and hands them over as they are. */
    private static final String PASS_THROUGH_VARS = "recipientName,title,message,actionUrl,systemName";
    /** What the Audit Trail raises says, in its own words: what was done, to which record, by whom, with which comment (the wording an administrator edits). */
    static final String AUDIT_SUMMARY = "{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}";
    /** REPORT-TEMPLATE-REJECT-NOTICE-2026-11-15: the author is told which template was rejected, by whom, and the reason in so many words (migration V790 does the same for a database that has the event). */
    static final String REPORT_TEMPLATE_REJECTED = "report.template_rejected";
    static final String REPORT_TEMPLATE_REJECTED_SUMMARY = "{{entityName}} was rejected by {{actorName}}. Reason: {{actionComment}}";
    private static final String AUDIT_VARS = PASS_THROUGH_VARS + ",actorName,entityName,actionComment,actionName";

    /** The registry events of the modules and the notices of Training Management. */
    private List<EventSeed> catalog() {
        List<EventSeed> all = new java.util.ArrayList<>(coreCatalog());
        for (com.eqms.service.training.TrainingNotificationEvents.Event event : com.eqms.service.training.TrainingNotificationEvents.all()) {
            all.add(new EventSeed(event.registryCode(), event.name(), event.description(), "TRAINING", event.priority(),
                    "NOTIFY", "TRAINING", event.channels(), PASS_THROUGH_VARS + ",actorName,trainingNumber,documentNumber,trainingDueDate,requestNumber",
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
                    AUDIT_VARS, new String[]{}, event.name(), REPORT_TEMPLATE_REJECTED.equals(event.code()) ? REPORT_TEMPLATE_REJECTED_SUMMARY : AUDIT_SUMMARY, rules, event.defaultStatus()));
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
                        "REPLACE_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,userName",
                        new String[]{"RECIPIENT"},
                        "Workflow assignee unavailable",
                        "{{documentNumber}} — {{documentTitle}}: the pending {{participantType}} {{userName}} is no longer available. Replace the assignment so the revision can continue."
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
                        "ESCALATE_PARTICIPANT", "DOCUMENT_REVISION", "IN_APP", STD_VARS + ",participantType,userName,daysPending",
                        new String[]{"RECIPIENT"},
                        "Revision stuck in workflow",
                        "{{documentNumber}} — {{documentTitle}} has been waiting for {{participantType}} {{userName}} for {{daysPending}} day(s)."
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
                        // recipient rule (the audience is every Active account).
                        "document.expired", "Document Expired",
                        "An Active document has reached its Valid Until date. Its controlled copies are voided and no copy can be requested.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "EXPIRE", "DOCUMENT", "IN_APP,EMAIL", STD_VARS,
                        new String[]{},
                        "Document expired", "{{documentNumber}} — {{documentTitle}} has passed its Valid Until date. Do not use it."
                ),
                new EventSeed(
                        "document.expired_copy_holder", "Document Expired (Copy Holder)",
                        "Sent to the holders of controlled copies that were voided because the document expired.",
                        "DOCUMENT_CONTROL", NotificationEventDefinition.PRIORITY_HIGH,
                        "EXPIRE", "DOCUMENT", "IN_APP,EMAIL", STD_VARS,
                        new String[]{},
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
                        "TIME_LIMITED_EXPIRE", "USER_ACCOUNT", "IN_APP", STD_VARS,
                        new String[]{"OWNER"},
                        "Your access has expired", "Your time-limited access ended on {{endDate}} and your account has been suspended."
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
