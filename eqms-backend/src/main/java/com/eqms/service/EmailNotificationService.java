package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.EmailTemplate;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.entity.NotificationDeliveryFailure;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.NotificationDeliveryFailureRepository;
import com.eqms.util.NotificationPreferenceUtils;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.util.EmailTemplateTypeUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final ObjectProvider<EmailService> emailServiceProvider;
    private final EmailTemplateRepository templateRepository;
    private final ObjectProvider<SystemConfigurationService> systemConfigurationServiceProvider;
    private final NotificationService notificationService;
    private final UserAccountRepository userAccountRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    private ObjectProvider<NotificationDeliveryFailureRepository> deliveryFailureRepositoryProvider;

    @Autowired
    private ObjectProvider<NotificationDispatcher> notificationDispatcherProvider;

    @Autowired
    private ObjectProvider<AuditTrailService> auditTrailServiceProvider;

    @Autowired
    private ObjectProvider<SystemActorProvider> systemActorProviderProvider;

    @Autowired
    private NotificationPolicyRepository notificationPolicyRepository;

    @Autowired
    private NotificationTemplateVersionRepository notificationTemplateVersionRepository;

    @Value("${app.public-url:http://localhost:3000}")
    private String envPublicAppUrl;

    public EmailNotificationService(
            ObjectProvider<EmailService> emailServiceProvider,
            EmailTemplateRepository templateRepository,
            ObjectProvider<SystemConfigurationService> systemConfigurationServiceProvider,
            NotificationService notificationService,
            UserAccountRepository userAccountRepository,
            ObjectMapper objectMapper
    ) {
        this.emailServiceProvider = emailServiceProvider;
        this.templateRepository = templateRepository;
        this.systemConfigurationServiceProvider = systemConfigurationServiceProvider;
        this.notificationService = notificationService;
        this.userAccountRepository = userAccountRepository;
        this.objectMapper = objectMapper;
    }

    public void sendDocumentWorkflowNotification(String templateType, Collection<UserAccount> recipients, Map<String, String> variables) {
        sendToRecipients(templateType, recipients, variables, "DOCUMENT");
    }

    public void sendControlledCopyNotification(String templateType, Collection<UserAccount> recipients, Map<String, String> variables) {
        sendToRecipients(templateType, recipients, variables, "CONTROLLED_COPY");
    }

    public void sendControlledCopyNotificationToEmails(String templateType, Collection<String> recipientEmails, Map<String, String> variables) {
        String normalizedType = EmailTemplateTypeUtils.normalize(templateType);
        if (!StringUtils.hasText(normalizedType) || recipientEmails == null || recipientEmails.isEmpty()) {
            return;
        }

        EmailTemplate template = templateRepository
                .findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(normalizedType, "Active")
                .orElse(null);
        if (template == null) {
            log.debug("No active email template found for type '{}'. Skipping controlled copy email notification.", normalizedType);
            return;
        }

        for (String recipientEmail : recipientEmails) {
            if (!StringUtils.hasText(recipientEmail)) {
                continue;
            }
            UserAccount recipientUser = userAccountRepository.findByEmailIgnoreCase(recipientEmail.trim()).orElse(null);
            Map<String, String> payload = buildUserVariables(null, null, variables);
            payload.put("recipientEmail", recipientEmail.trim());
            payload.put("userEmail", recipientEmail.trim());
            payload.put("recipientName", recipientEmail.trim());
            payload.put("fullName", recipientEmail.trim());
            payload.put("displayName", recipientEmail.trim());
            payload.put("userName", recipientEmail.trim());
            if (!isPolicyManaged(variables) && recipientUser != null
                    && NotificationPreferenceUtils.canReceiveInAppNotification(objectMapper, recipientUser, resolveModuleKey(normalizedType))) {
                recordInboxNotificationFromTemplate(
                        template,
                        recipientUser,
                        null,
                        resolveModuleName(normalizedType),
                        normalizedType,
                        resolveScope(normalizedType),
                        payload
                );
            }
            try {
                EmailService emailService = emailServiceProvider.getIfAvailable();
                if (emailService == null) {
                    log.warn("EmailService is not available. Skipping controlled copy notification to {}", recipientEmail);
                    continue;
                }
                if (recipientUser != null && !NotificationPreferenceUtils.canReceiveEmailNotification(objectMapper, recipientUser, resolveModuleKey(normalizedType))) {
                    log.debug("Skipping email notification for {} because email notifications are disabled for this module.", recipientEmail);
                    continue;
                }
                boolean sent = sendTemplateEmailWithRetry(emailService, recipientEmail.trim(), template, payload, true);
                if (!sent) {
                    String reason = "Email provider rejected delivery or is not configured";
                    recordDeliveryFailure(
                            recipientEmail,
                            normalizedType,
                            "CONTROLLED_COPY",
                            new IllegalStateException(reason), payload
                    );
                    auditEmailAttempt(recipientEmail, recipientEmail, template.getName(), payload, false, reason);
                    log.warn(
                            "Email template '{}' was not sent to {} because email notifications are disabled or SMTP is not configured.",
                            template.getName(),
                            recipientEmail
                    );
                } else {
                    auditEmailAttempt(recipientEmail, recipientEmail, template.getName(), payload, true, null);
                }
            } catch (Exception ex) {
                recordDeliveryFailure(recipientEmail, normalizedType, "CONTROLLED_COPY", ex, payload);
                auditEmailAttempt(recipientEmail, recipientEmail, template.getName(), payload, false, ex.getMessage());
                log.warn("Failed to send '{}' controlled copy notification to {}: {}", normalizedType, recipientEmail, ex.getMessage(), ex);
            }
        }
    }

    /**
     * Sends the one aggregated "batch distributed" email to the DCO with a ZIP attachment,
     * when the Controlled Copies Policy redirects delivery to the DCO. Distinct from {@link
     * #sendControlledCopyNotification} because it needs the attachment overload of EmailService.
     */
    public void sendControlledCopyBatchZipToDco(UserAccount dco, UserAccount actor, Map<String, String> variables, String attachmentFileName, byte[] attachmentBytes) {
        if (dco == null || !StringUtils.hasText(dco.getEmail())) {
            log.warn("Cannot send controlled copy batch ZIP: no DCO recipient email configured.");
            return;
        }
        String normalizedType = EmailTemplateTypeUtils.CONTROLLED_COPY_BATCH_DISTRIBUTION_DCO_ZIP;
        EmailTemplate template = templateRepository
                .findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(normalizedType, "Active")
                .orElse(null);
        if (template == null) {
            log.warn("No active email template found for type '{}'. Skipping DCO batch ZIP notification.", normalizedType);
            return;
        }
        Map<String, String> payload = buildUserVariables(dco, actor, variables);
        try {
            EmailService emailService = emailServiceProvider.getIfAvailable();
            if (emailService == null) {
                log.warn("EmailService is not available. Skipping DCO batch ZIP notification to {}", dco.getEmail());
                return;
            }
            boolean sent = emailService.sendTemplateEmailWithAttachment(dco.getEmail(), template, payload, attachmentFileName, attachmentBytes);
            if (!sent) {
                String reason = "Email provider rejected delivery or is not configured";
                recordDeliveryFailure(dco.getEmail(), normalizedType, "CONTROLLED_COPY",
                        new IllegalStateException(reason), payload);
                auditEmailAttempt(dco.getFullName(), dco.getEmail(), template.getName(), payload, false, reason);
            } else {
                auditEmailAttempt(dco.getFullName(), dco.getEmail(), template.getName(), payload, true, null);
            }
        } catch (Exception ex) {
            recordDeliveryFailure(dco.getEmail(), normalizedType, "CONTROLLED_COPY", ex, payload);
            auditEmailAttempt(dco.getFullName(), dco.getEmail(), template.getName(), payload, false, ex.getMessage());
            log.warn("Failed to send DCO batch ZIP notification to {}: {}", dco.getEmail(), ex.getMessage(), ex);
        }
    }

    /**
     * Records a visible, non-silent failure when Controlled Copies Policy says delivery should be
     * redirected to the DCO but that couldn't happen (misconfigured -- no permission, inactive
     * account, deleted user, etc.) -- distinct from a real email/SMTP send failure (channel=
     * "CONFIG"), so an admin browsing the delivery-failures screen can tell "this policy is
     * broken" apart from "SMTP rejected this send". The distribute/batch action itself still
     * falls back to normal (non-redirected) delivery so nothing is silently lost.
     */
    public void recordControlledCopyDcoMisconfiguration(String context, String reasonMessage) {
        log.warn("Controlled Copies Policy DCO delivery redirect is misconfigured ({}): {}", context, reasonMessage);
        recordDeliveryFailure(
                StringUtils.hasText(context) ? context : "controlled-copy-dco",
                "controlled-copy-dco-misconfigured",
                "CONTROLLED_COPY",
                "CONFIG",
                new IllegalStateException(reasonMessage),
                Map.of()
        );
    }

    public void sendPreferenceNotification(UserAccount recipient, Map<String, String> variables) {
        sendToRecipients("preference-notification", recipient == null ? List.of() : List.of(recipient), variables, "PREFERENCES");
    }

    public Map<String, String> buildDocumentVariables(
            DocumentRecord document,
            DocumentRevisionRecord revision,
            UserAccount actor,
            UserAccount recipient,
            String action,
            String comment,
            Map<String, String> variables
    ) {
        Map<String, String> merged = buildUserVariables(recipient, actor, variables);
        if (document != null) {
            merged.put("documentId", value(document.getId() == null ? null : document.getId().toString()));
            merged.put("documentTitle", value(document.getDocumentName()));
            merged.put("documentNumber", value(document.getDocumentNumber()));
            merged.put("documentVersion", value(document.getVersion()));
            merged.put("documentStatus", value(document.getStatus() == null ? null : document.getStatus().getCode()));
            merged.put("documentReviewDate", formatDate(document.getReviewDate()));
            merged.put("documentEffectiveDate", formatDate(document.getEffectiveDate()));
            merged.put("documentValidUntil", formatDate(document.getValidUntil()));
            merged.put("documentUrl", buildDocumentUrl(document));
            merged.put("documentAuthorName", document.getAuthor() == null ? "" : value(document.getAuthor().getFullName()));
            merged.put("documentAuthorEmail", document.getAuthor() == null ? "" : value(document.getAuthor().getEmail()));
            merged.put("documentDepartment", document.getDepartment() == null ? "" : value(document.getDepartment().getName()));
            merged.put("documentBusinessUnit", document.getBusinessUnit() == null ? "" : value(document.getBusinessUnit().getName()));
        }
        if (revision != null) {
            merged.put("revisionId", value(revision.getId() == null ? null : revision.getId().toString()));
            merged.put("revisionTitle", value(revision.getRevisionName()));
            merged.put("revisionName", value(revision.getRevisionName()));
            merged.put("revisionNumber", value(revision.getRevisionNumber()));
            merged.put("revisionStatus", value(revision.getStatus() == null ? null : revision.getStatus().getCode()));
            merged.put("revisionUrl", buildRevisionUrl(revision));
            merged.put("officeEditUrl", value(revision.getStorageEditUrl()));
            merged.put("officeViewUrl", value(revision.getStorageViewUrl()));
            merged.put("revisionEffectiveDate", formatDate(revision.getEffectiveDate()));
            merged.put("revisionValidUntil", formatDate(revision.getValidUntil()));
            merged.put("revisionPublishedAt", formatDateTime(revision.getPublishedAt()));
            merged.put("revisionPublishedBy", revision.getPublishedBy() == null ? nullSafe(actor) : value(revision.getPublishedBy().getFullName()));
            merged.put("trainingPlannedDate", formatDate(revision.getTrainingPlannedDate()));
            merged.put("trainingPeriodEndDate", formatDate(revision.getTrainingPeriodEndDate()));
            merged.put("trainingCompletionDate", formatDate(revision.getTrainingCompletionDate()));
            merged.put("workflowStage", value(revision.getStatus() == null ? null : revision.getStatus().getCode()));
            merged.put("workflowAction", value(action));
            merged.put("workflowReason", value(comment));
            merged.put("workflowComment", value(comment));
        }
        merged.put("systemName", merged.getOrDefault("systemName", "EQMS"));
        merged.put("companyName", merged.getOrDefault("companyName", "EQMS"));
        return merged;
    }

    public Map<String, String> buildControlledCopyVariables(
            ControlledCopyRecord copy,
            UserAccount actor,
            UserAccount recipient,
            String action,
            String comment,
            Map<String, String> variables
    ) {
        Map<String, String> merged = buildUserVariables(recipient, actor, variables);
        if (copy != null) {
            // Lets auditEmailAttempt() anchor the "email sent" audit row to this specific
            // Controlled Copy (not just its parent Document/Revision) when neither of those ids
            // is present in the payload.
            merged.put("controlledCopyId", copy.getId() == null ? "" : copy.getId().toString());
            merged.put("controlledCopyNumber", value(copy.getControlledCopyNumber()));
            merged.put("copyNumber", copy.getCopyNumber() > 0 ? String.valueOf(copy.getCopyNumber()) : "");
            merged.put("totalCopies", copy.getTotalCopies() > 0 ? String.valueOf(copy.getTotalCopies()) : "");
            merged.put("documentId", copy.getDocument() == null || copy.getDocument().getId() == null ? null : copy.getDocument().getId().toString());
            merged.put("documentTitle", value(copy.getDocumentTitle()));
            merged.put("documentNumber", value(copy.getDocumentNumber()));
            merged.put("documentUrl", copy.getDocument() == null || copy.getDocument().getId() == null ? "" : "/documents/" + copy.getDocument().getId());
            merged.put("revisionId", copy.getRevision() == null || copy.getRevision().getId() == null ? null : copy.getRevision().getId().toString());
            merged.put("revisionNumber", value(copy.getRevisionNumber()));
            merged.put("controlledCopyStatus", value(copy.getStatus()));
            merged.put("controlledCopyUrl", copy.getId() == null ? "" : "/documents/controlled-copies/" + copy.getId());
            merged.put("controlledCopyPreviewUrl", buildControlledCopyPreviewUrl(copy));
            merged.put("previewToken", value(copy.getAccessToken()));
            // The Cancellation/Recall/Obsoleted templates render "Scope: {{workflowScope}}" and
            // "Batch Number: {{batchNumber}}" unconditionally -- they were populated only by
            // buildControlledCopyBatchVariables (the bulk cancelBatch()/recallBatch() path), so a
            // SINGLE-copy action (cancelControlledCopy, recall of one copy, etc. -- the far more
            // common case) left both placeholders completely unsubstituted in the recipient's
            // inbox: "Scope: {{workflowScope}} Batch Number: {{batchNumber}}", verbatim. Every
            // copy belongs to a batch even when only it (not the whole batch) is being acted on,
            // so scope is "Individual Copy" (to distinguish from an actual bulk batch action) and
            // the real batch number is still shown for reference.
            merged.put("workflowScope", "Individual Copy");
            merged.put("batchNumber", safeBatchNumber(copy));
            merged.put("workflowStage", value(copy.getCurrentStage()));
            merged.put("workflowAction", humanizeControlledCopyAction(action));
            merged.put("workflowComment", value(comment));
            merged.put("distributionList", value(copy.getDistributionList()));
            merged.put("distributionScope", value(copy.getDistributionScope()));
            merged.put("distributionLocation", value(copy.getLocation()));
            merged.put("locationCode", value(copy.getLocationCode()));
            merged.put("requestReason", value(copy.getRequestReason()));
            merged.put("distributionComment", value(copy.getDistributionComment()));
            merged.put("recipientName", value(copy.getRecipientName()));
            merged.put("recipientSignature", value(copy.getRecipientSignature()));
            merged.put("recipientDate", formatDate(copy.getRecipientDate()));
            merged.put("destroyReason", value(copy.getDestroyReason()));
            merged.put("destructionType", value(copy.getDestructionType()));
            merged.put("destructionMethod", value(copy.getDestructionMethod()));
            merged.put("destroyedAt", formatDateTime(copy.getDestroyedAt()));
            merged.put("destroyedBy", copy.getDestroyedBy() == null ? nullSafe(actor) : value(copy.getDestroyedBy().getFullName()));
            merged.put("witnessName", value(copy.getWitnessedBy()));
            merged.put("recallReason", value(copy.getRecallReason()));
            merged.put("validUntil", formatDate(copy.getValidUntil()));
            merged.put("effectiveDate", formatDate(copy.getEffectiveDate()));
            merged.put("hasExpiryDate", Boolean.TRUE.equals(copy.getHasExpiryDate()) ? "true" : "false");
            merged.put("expiryDate", formatDateTime(copy.getExpiryDate()));
            // Canonical name used by the templates / notification-event catalog
            // ("{{controlledCopyNumber}} expires on {{expiryDateDisplay}}"). Date-only.
            merged.put("expiryDateDisplay", formatInstantAsDate(copy.getExpiryDate()));
            merged.put("expiryReminderSentAt", formatDateTime(copy.getExpiryReminderSentAt()));
        }
        merged.put("systemName", merged.getOrDefault("systemName", "EQMS"));
        merged.put("companyName", merged.getOrDefault("companyName", "EQMS"));
        return merged;
    }

    public Map<String, String> buildControlledCopyBatchVariables(
            ControlledCopyDistributionBatch batch,
            UserAccount actor,
            UserAccount recipient,
            String action,
            String comment,
            Map<String, String> variables
    ) {
        Map<String, String> merged = buildUserVariables(recipient, actor, variables);
        if (batch != null) {
            merged.put("controlledCopyBatchId", batch.getId() == null ? "" : batch.getId().toString());
            merged.put("workflowScope", "Batch");
            merged.put("batchNumber", value(batch.getBatchNumber()));
            merged.put("batchQuantity", batch.getQuantity() > 0 ? String.valueOf(batch.getQuantity()) : "");
            merged.put("controlledCopyNumber", value(batch.getBatchNumber()));
            merged.put("copyNumber", "");
            merged.put("totalCopies", batch.getQuantity() > 0 ? String.valueOf(batch.getQuantity()) : "");
            merged.put("documentId", batch.getDocument() == null || batch.getDocument().getId() == null ? null : batch.getDocument().getId().toString());
            merged.put("documentTitle", value(batch.getDocumentTitle()));
            merged.put("documentNumber", value(batch.getDocumentNumber()));
            merged.put("documentUrl", batch.getDocument() == null || batch.getDocument().getId() == null ? "" : "/documents/" + batch.getDocument().getId());
            merged.put("revisionId", batch.getRevision() == null || batch.getRevision().getId() == null ? null : batch.getRevision().getId().toString());
            merged.put("revisionNumber", value(batch.getRevisionNumber()));
            merged.put("controlledCopyStatus", value(batch.getStatus()));
            merged.put("controlledCopyUrl", batch.getId() == null ? "" : "/documents/controlled-copies/" + batch.getId());
            merged.put("controlledCopyPreviewUrl", batch.getId() == null ? "" : "/documents/controlled-copies/" + batch.getId());
            merged.put("previewToken", "");
            merged.put("workflowStage", value(batch.getStatus()));
            merged.put("workflowAction", humanizeControlledCopyAction(action));
            merged.put("workflowComment", value(comment));
            merged.put("distributionList", value(batch.getDistributionList()));
            merged.put("distributionScope", value(batch.getDistributionScope()));
            merged.put("distributionLocation", value(batch.getLocation()));
            merged.put("locationCode", value(batch.getLocationCode()));
            merged.put("requestReason", value(batch.getRequestReason()));
            merged.put("distributionComment", value(batch.getDistributionComment()));
            merged.put("recipientName", value(batch.getDistributionList()));
            merged.put("recipientSignature", "");
            merged.put("recipientDate", formatDateTime(batch.getDistributedAt()));
            merged.put("destroyReason", "");
            merged.put("destructionType", "");
            merged.put("destructionMethod", "");
            merged.put("destroyedAt", formatDateTime(batch.getDistributedAt()));
            merged.put("destroyedBy", batch.getDistributedBy() == null ? nullSafe(actor) : value(batch.getDistributedBy().getFullName()));
            merged.put("witnessName", "");
            merged.put("recallReason", value(batch.getDistributionComment()));
            merged.put("validUntil", formatDateTime(batch.getExpiryDate()));
            merged.put("effectiveDate", formatDateTime(batch.getDistributedAt()));
            merged.put("hasExpiryDate", Boolean.TRUE.equals(batch.getHasExpiryDate()) ? "true" : "false");
            merged.put("expiryDate", formatDateTime(batch.getExpiryDate()));
            merged.put("expiryDateDisplay", formatInstantAsDate(batch.getExpiryDate()));
            merged.put("expiryReminderSentAt", "");
        }
        merged.put("systemName", merged.getOrDefault("systemName", "EQMS"));
        merged.put("companyName", merged.getOrDefault("companyName", "EQMS"));
        return merged;
    }

    private String buildControlledCopyPreviewUrl(ControlledCopyRecord copy) {
        if (copy == null || copy.getId() == null) {
            return "";
        }
        String baseUrl = resolvePublicAppBaseUrl();
        String token = copy.getAccessToken();
        if (!StringUtils.hasText(token)) {
            return baseUrl + "/documents/controlled-copies/" + copy.getId();
        }
        // Must be the standalone, no-login public route (outside ProtectedRoute/MainLayout) --
        // "/documents/controlled-copies/preview/..." (the old value here) requires an internal
        // eQMS login just to reach the route, and even when reached from an already-authenticated
        // browser session, that session's JWT gets attached to every subsequent preview/download
        // call and is checked against the copy's actual recipient, denying access whenever the
        // logged-in user isn't that exact recipient. See routes.constants.ts
        // PUBLIC_CONTROLLED_COPY_PREVIEW for the frontend route this must match.
        //
        // BUGFIX: the token MUST be a URL fragment ("#token="), not a query parameter
        // ("?token="). A query parameter is sent to the server on the very first request and can
        // end up in server access logs, intermediate proxy logs, or a Referer header if the page
        // ever loads a third-party resource -- exactly what ControlledCopyPreviewView.tsx's own
        // fragment-only design (and its "never sent in the initial HTTP request" comment) exists
        // to prevent. The frontend already falls back to reading a "?token=" query parameter too,
        // so old links already delivered before this fix keep working.
        return baseUrl + "/controlled-copy-preview/" + copy.getId() + "#token=" + token;
    }

    /** The "download" link inside the DCO's batch-ZIP email: an ordinary, login-required app route
     *  (never a public/token link) that rebuilds and downloads the same ZIP on demand. */
    public String buildControlledCopyDcoZipDownloadUrl(java.util.UUID batchId) {
        if (batchId == null) {
            return "";
        }
        return resolvePublicAppBaseUrl() + "/documents/controlled-copies/batches/" + batchId + "/dco-zip";
    }

    private String resolvePublicAppBaseUrl() {
        String configured = null;
        SystemConfigurationService systemConfigurationService = systemConfigurationServiceProvider.getIfAvailable();
        if (systemConfigurationService != null) {
            try {
                var config = systemConfigurationService.requireConfiguration();
                var notifications = config == null ? null : config.getNotificationsConfig();
                if (notifications != null) {
                    var value = notifications.get("publicAppUrl");
                    if (value != null && !value.isNull()) {
                        configured = value.asText();
                    }
                }
            } catch (Exception ignored) {
                // Fall back to env/default.
            }
        }
        String baseUrl = StringUtils.hasText(configured) ? configured.trim() : envPublicAppUrl;
        if (!StringUtils.hasText(baseUrl)) {
            baseUrl = "http://localhost:3000";
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public Map<String, String> buildPreferenceVariables(
            UserAccount actor,
            UserAccount recipient,
            String section,
            String action,
            String comment,
            Map<String, String> variables
    ) {
        Map<String, String> merged = buildUserVariables(recipient, actor, variables);
        merged.put("preferenceSection", value(section));
        merged.put("preferenceName", value(section));
        merged.put("workflowStage", value(section));
        merged.put("workflowAction", value(action));
        merged.put("workflowComment", value(comment));
        merged.put("changeSummary", value(comment));
        merged.put("updatedAt", DateTimeFormatUtils.formatDateTime(Instant.now()));
        return merged;
    }

    public boolean sendByTypeToRecipients(String templateType, Collection<UserAccount> recipients, Map<String, String> variables) {
        return sendToRecipients(templateType, recipients, variables, null);
    }

    private boolean sendToRecipients(String templateType, Collection<UserAccount> recipients, Map<String, String> variables, String eventDomain) {
        String normalizedType = EmailTemplateTypeUtils.normalize(templateType);
        if (!StringUtils.hasText(normalizedType) || recipients == null || recipients.isEmpty()) {
            return false;
        }
        EmailTemplate template = templateRepository
                .findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(normalizedType, "Active")
                .orElse(null);
        if (template == null) {
            log.debug("No active email template found for type '{}'. Skipping {} notification.", normalizedType, eventDomain == null ? "email" : eventDomain.toLowerCase(Locale.ROOT));
            return false;
        }

        boolean sentAny = false;
        for (UserAccount recipient : recipients) {
            if (recipient == null) {
                continue;
            }
            boolean mandatoryNotification = variables != null && "true".equals(variables.get("notificationMandatory"));
            String moduleKey = resolveModuleKey(normalizedType);
            Map<String, String> payload = buildUserVariables(recipient, null, variables);
            dispatchPolicyNotification(recipient, payload);
            if (!isPolicyManaged(variables) && (mandatoryNotification || NotificationPreferenceUtils.canReceiveInAppNotification(objectMapper, recipient, moduleKey))) {
                recordInboxNotificationFromTemplate(
                        template,
                        recipient,
                        null,
                        resolveModuleName(normalizedType),
                        normalizedType,
                        resolveScope(normalizedType),
                        payload
                );
            }
            List<String> recipientEmails = resolveRecipientEmails(recipient);
            if (recipientEmails.isEmpty()) {
                continue;
            }
            try {
                EmailService emailService = emailServiceProvider.getIfAvailable();
                if (emailService == null) {
                    log.warn("EmailService is not available. Skipping {} notification to {}", eventDomain, recipient.getEmail());
                    continue;
                }
                if (!mandatoryNotification && !NotificationPreferenceUtils.canReceiveEmailNotification(objectMapper, recipient, moduleKey)) {
                    log.debug("Skipping email notification for {} because email notifications are disabled for this module.", recipient.getEmail());
                    continue;
                }
                boolean userSent = false;
                for (int index = 0; index < recipientEmails.size(); index++) {
                    String recipientEmail = recipientEmails.get(index);
                    Map<String, String> emailPayload = new LinkedHashMap<>(buildUserVariables(recipient, null, variables));
                    emailPayload.put("recipientEmail", recipientEmail);
                    emailPayload.put("userEmail", recipientEmail);
                    emailPayload.put("displayName", StringUtils.hasText(recipient.getFullName()) ? recipient.getFullName() : recipientEmail);
                    boolean sent = sendTemplateEmailWithRetry(emailService, recipientEmail, template, emailPayload, !userSent);
                    userSent = userSent || sent;
                    sentAny = sentAny || sent;
                    if (!sent) {
                        String reason = "Email provider rejected delivery or is not configured";
                        recordDeliveryFailure(
                                recipientEmail,
                                normalizedType,
                                eventDomain,
                                new IllegalStateException(reason), emailPayload
                        );
                        auditEmailAttempt(recipient.getFullName(), recipientEmail, template.getName(), emailPayload, false, reason);
                        log.warn("Email template '{}' was not sent to {} because email notifications are disabled or SMTP is not configured.", template.getName(), recipientEmail);
                    } else {
                        auditEmailAttempt(recipient.getFullName(), recipientEmail, template.getName(), emailPayload, true, null);
                    }
                }
            } catch (Exception ex) {
                recordDeliveryFailure(recipient.getEmail(), normalizedType, eventDomain, ex, variables);
                auditEmailAttempt(recipient.getFullName(), recipient.getEmail(), template.getName(), variables, false, ex.getMessage());
                log.warn("Failed to send '{}' notification to {}: {}", normalizedType, recipient.getEmail(), ex.getMessage(), ex);
            }
        }
        return sentAny;
    }

    /**
     * Policy-driven EMAIL-channel send for {@link NotificationDispatcher} -- content is already
     * rendered from a {@code NotificationTemplateVersion} row (no legacy {@link EmailTemplate}
     * lookup), but reuses the exact same retry/failure-tracking discipline as the legacy
     * template-type sends so callers get one consistent reliability story regardless of which
     * pipeline produced the content.
     */
    public boolean sendRenderedEmailWithTracking(
            String recipientEmail, String subject, String body, String eventCode, String eventDomain, Map<String, String> payload
    ) {
        if (!StringUtils.hasText(recipientEmail) || !StringUtils.hasText(subject) || !StringUtils.hasText(body)) {
            return false;
        }
        EmailService emailService = emailServiceProvider.getIfAvailable();
        if (emailService == null) {
            log.warn("EmailService is not available. Skipping policy-driven notification '{}' to {}", eventCode, recipientEmail);
            return false;
        }
        String recipientLabel = payload == null ? recipientEmail
                : payload.getOrDefault("fullName", payload.getOrDefault("recipientName", recipientEmail));
        try {
            boolean sent = sendRenderedEmailWithRetry(emailService, recipientEmail, subject, body);
            if (!sent) {
                String reason = "Email provider rejected delivery or is not configured";
                recordDeliveryFailure(recipientEmail, eventCode, eventDomain,
                        new IllegalStateException(reason), payload);
                auditEmailAttempt(recipientLabel, recipientEmail, eventCode, payload, false, reason);
                log.warn("Policy-driven email '{}' was not sent to {} because email notifications are disabled or SMTP is not configured.", eventCode, recipientEmail);
            } else {
                auditEmailAttempt(recipientLabel, recipientEmail, eventCode, payload, true, null);
            }
            return sent;
        } catch (Exception ex) {
            recordDeliveryFailure(recipientEmail, eventCode, eventDomain, ex, payload);
            auditEmailAttempt(recipientLabel, recipientEmail, eventCode, payload, false, ex.getMessage());
            log.warn("Failed to send policy-driven email '{}' to {}: {}", eventCode, recipientEmail, ex.getMessage(), ex);
            return false;
        }
    }

    private boolean sendRenderedEmailWithRetry(EmailService emailService, String recipientEmail, String subject, String body) throws Exception {
        Exception lastFailure = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                if (emailService.sendRenderedEmail(recipientEmail, subject, body)) {
                    return true;
                }
            } catch (Exception ex) {
                lastFailure = ex;
                if (attempt == 3) {
                    throw ex;
                }
            }
            if (attempt < 3) {
                try {
                    Thread.sleep(200L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Email delivery retry was interrupted", interrupted);
                }
            }
        }
        if (lastFailure != null) {
            throw lastFailure;
        }
        return false;
    }

    /**
     * Retries transient SMTP/provider failures a small, bounded number of times.
     * A false result is also retried because EmailService uses it for a provider
     * rejection/configuration failure without throwing an exception. The caller
     * persists a delivery failure only after all attempts have been exhausted.
     */
    private boolean sendTemplateEmailWithRetry(
            EmailService emailService,
            String recipientEmail,
            EmailTemplate template,
            Map<String, String> payload,
            boolean firstEmail
    ) throws Exception {
        Exception lastFailure = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                if (emailService.sendTemplateEmail(recipientEmail, template, payload, firstEmail, false)) {
                    return true;
                }
            } catch (Exception ex) {
                lastFailure = ex;
                if (attempt == 3) {
                    throw ex;
                }
            }
            if (attempt < 3) {
                try {
                    Thread.sleep(200L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Email delivery retry was interrupted", interrupted);
                }
            }
        }
        if (lastFailure != null) {
            throw lastFailure;
        }
        return false;
    }

    private void recordInboxNotificationFromTemplate(
            EmailTemplate template,
            UserAccount recipient,
            UserAccount sender,
            String module,
            String type,
            String scope,
            Map<String, String> variables
    ) {
        try {
            if (notificationService == null || template == null || recipient == null || recipient.getId() == null) {
                return;
            }
            notificationService.recordFromEmailTemplate(
                    template,
                    recipient,
                    sender,
                    StringUtils.hasText(module) ? module : "System",
                    type,
                    StringUtils.hasText(scope) ? scope : "personal",
                    variables
            );
        } catch (Exception ex) {
            log.warn("Failed to create in-app notification for template '{}': {}", template == null ? "" : template.getName(), ex.getMessage(), ex);
            recordInAppDeliveryFailure(recipient, type, ex);
        }
    }

    /**
     * Records that the system attempted to email a recipient (an Author/Co-Author/Reviewer/
     * Approver being notified of an assignment or workflow step, a Controlled Copy recipient,
     * etc.) as an audit trail entry -- so an inspector (or a "I was never notified" dispute) has
     * durable, attributable evidence of whether and when the notification was actually sent, not
     * just that the workflow step itself happened. Anchored to the most specific related record
     * present in the payload (Revision > Controlled Copy > Controlled Copy Batch > Document) so it
     * surfaces directly in that record's own Audit Trail tab, not only in the global "All Records"
     * view. The actor is always the reserved SYSTEM account: the human whose action triggered the
     * email (e.g. the Author who submitted for review) already has their own audit row for that
     * action -- this row is attributable to the system's own delivery, not to them.
     */
    private void auditEmailAttempt(
            String recipientLabel, String recipientEmail, String notificationLabel,
            Map<String, String> payload, boolean success, String failureReason
    ) {
        if (!StringUtils.hasText(recipientEmail)) {
            return;
        }
        try {
            AuditTrailService auditTrailService = auditTrailServiceProvider.getIfAvailable();
            SystemActorProvider systemActorProvider = systemActorProviderProvider.getIfAvailable();
            if (auditTrailService == null || systemActorProvider == null) {
                return;
            }
            String entityType;
            UUID entityId;
            String revisionId = payload == null ? null : payload.get("revisionId");
            String controlledCopyId = payload == null ? null : payload.get("controlledCopyId");
            String batchId = payload == null ? null : payload.get("controlledCopyBatchId");
            String documentId = payload == null ? null : payload.get("documentId");
            if (StringUtils.hasText(revisionId)) {
                entityType = "REVISION";
                entityId = safeUuid(revisionId);
            } else if (StringUtils.hasText(controlledCopyId)) {
                entityType = "CONTROLLED_COPY";
                entityId = safeUuid(controlledCopyId);
            } else if (StringUtils.hasText(batchId)) {
                entityType = "CONTROLLED_COPY_DISTRIBUTION_BATCH";
                entityId = safeUuid(batchId);
            } else if (StringUtils.hasText(documentId)) {
                entityType = "DOCUMENT";
                entityId = safeUuid(documentId);
            } else {
                // entity_id is NOT NULL in audit_logs -- there is no related Document/Revision/
                // Controlled Copy to anchor to (e.g. a preference-change notification), so
                // synthesise an id for this send the same way Login synthesises an "Authentication
                // Session" id rather than leaving the column null.
                entityType = "NOTIFICATION";
                entityId = UUID.randomUUID();
            }
            if (entityId == null) {
                // A related id was present in the payload but not a parseable UUID -- fall back to
                // the same synthesis rather than risk a NOT NULL violation on entity_id.
                entityId = UUID.randomUUID();
            }
            String label = StringUtils.hasText(recipientLabel) ? recipientLabel : recipientEmail;
            String comment = success
                    ? "Email notification \"" + notificationLabel + "\" sent to " + label + " (" + recipientEmail + ")"
                    : "Email notification \"" + notificationLabel + "\" FAILED to send to " + label + " (" + recipientEmail + ")"
                            + (StringUtils.hasText(failureReason) ? ": " + failureReason : "");
            auditTrailService.logAs(
                    systemActorProvider.get(),
                    entityType,
                    entityType.equals("NOTIFICATION") ? notificationLabel : label,
                    entityId,
                    success ? "SEND_EMAIL" : "SEND_EMAIL_FAILED",
                    null,
                    null,
                    comment,
                    List.of(
                            new AuditTrailChangeResponse("Recipient", null, label + " <" + recipientEmail + ">"),
                            new AuditTrailChangeResponse("Notification", null, notificationLabel)
                    )
            );
        } catch (Exception ex) {
            log.warn("Failed to record audit trail entry for email notification '{}' to {}: {}",
                    notificationLabel, recipientEmail, ex.getMessage(), ex);
        }
    }

    private UUID safeUuid(String value) {
        try {
            return StringUtils.hasText(value) ? UUID.fromString(value.trim()) : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private void recordDeliveryFailure(String recipient, String type, String domain, Exception error) {
        recordDeliveryFailure(recipient, type, domain, error, Map.of());
    }

    private void recordDeliveryFailure(String recipient, String type, String domain, Exception error, Map<String, String> payload) {
        recordDeliveryFailure(recipient, type, domain, "EMAIL", error, payload);
    }

    /** Was a silent {@code log.warn} before NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 3 --
     * an in-app notification that failed to persist was invisible to everyone. Recorded with
     * {@code channel=IN_APP} so the admin delivery-failures screen can tell it apart from a real
     * SMTP failure (there is nothing to "retry send" for this channel; it's a visibility fix, not
     * a retry queue entry). */
    private void recordInAppDeliveryFailure(UserAccount recipient, String type, Exception error) {
        String identifier = recipient == null ? null
                : StringUtils.hasText(recipient.getUsername()) ? recipient.getUsername()
                : recipient.getId() == null ? null : recipient.getId().toString();
        recordDeliveryFailure(identifier, type, "IN_APP", "IN_APP", error, Map.of());
    }

    private void recordDeliveryFailure(String recipient, String type, String domain, String channel, Exception error, Map<String, String> payload) {
        try {
            NotificationDeliveryFailureRepository repository = deliveryFailureRepositoryProvider.getIfAvailable();
            if (repository == null || !StringUtils.hasText(recipient)) return;
            NotificationDeliveryFailure failure = new NotificationDeliveryFailure();
            failure.setRecipient(recipient.trim());
            failure.setNotificationType(StringUtils.hasText(type) ? type : "UNKNOWN");
            failure.setEventDomain(domain);
            failure.setChannel(StringUtils.hasText(channel) ? channel : "EMAIL");
            String message = error == null ? "Unknown notification delivery failure" : error.getMessage();
            failure.setErrorMessage(message == null ? "Unknown notification delivery failure" : message.substring(0, Math.min(message.length(), 4000)));
            failure.setPayloadJson(objectMapper.writeValueAsString(sanitizeRetryPayload(payload)));
            repository.save(failure);
        } catch (Exception persistenceError) {
            log.error("Failed to persist notification delivery failure", persistenceError);
        }
    }

    private Map<String, String> sanitizeRetryPayload(Map<String, String> payload) {
        if (payload == null || payload.isEmpty()) return Map.of();
        return payload.entrySet().stream()
                .filter(entry -> entry.getKey() != null && entry.getValue() != null)
                .filter(entry -> !entry.getKey().toLowerCase(Locale.ROOT).contains("password"))
                .filter(entry -> !entry.getKey().toLowerCase(Locale.ROOT).contains("secret"))
                .filter(entry -> !entry.getKey().toLowerCase(Locale.ROOT).contains("token"))
                .limit(200)
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().substring(0, Math.min(entry.getValue().length(), 2000)), (a, b) -> a, LinkedHashMap::new));
    }

    @Transactional
    public NotificationDeliveryFailure retryDeliveryFailure(UUID failureId) {
        NotificationDeliveryFailureRepository repository = deliveryFailureRepositoryProvider.getIfAvailable();
        if (repository == null) throw new IllegalStateException("Notification delivery tracking is unavailable");
        NotificationDeliveryFailure failure = repository.findById(failureId)
                .orElseThrow(() -> new IllegalArgumentException("Notification delivery failure not found"));
        if (failure.getAttempts() >= 5) throw new IllegalStateException("Notification retry limit reached");
        EmailService emailService = emailServiceProvider.getIfAvailable();
        if (emailService == null) throw new IllegalStateException("Email service is unavailable");

        Map<String, String> payload = StringUtils.hasText(failure.getPayloadJson())
                ? readPayload(failure.getPayloadJson())
                : new LinkedHashMap<>();

        // TBR-DOC-016 gap closure: a delivery failure whose notificationType is a
        // NotificationDispatcher event code (policy-driven -- rendered from a
        // NotificationTemplateVersion, not a legacy EmailTemplate) has no legacy EmailTemplate row
        // to look up, ever -- that lookup was written only for the pre-existing per-module legacy
        // template pipeline and was never updated when the newer policy-driven pipeline was added.
        // The durably-persisted payloadJson already holds exactly the variables the original send
        // rendered with, so the policy-driven event's own ACTIVE EMAIL NotificationTemplateVersion
        // can be re-rendered from that same payload and resent directly -- no legacy template
        // needs to be provisioned, and no second notification subsystem is introduced.
        Optional<NotificationPolicy> policy = notificationPolicyRepository.findByEventCode(failure.getNotificationType());
        if (policy.isPresent()) {
            return retryPolicyDrivenFailure(repository, failure, policy.get(), emailService, payload);
        }

        EmailTemplate template = templateRepository
                .findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(failure.getNotificationType(), "Active")
                .orElseThrow(() -> new IllegalStateException("No active email template is available for this notification"));
        try {
            boolean sent = sendTemplateEmailWithRetry(emailService, failure.getRecipient(), template, payload, true);
            failure.setAttempts(failure.getAttempts() + 1);
            failure.setLastAttemptAt(Instant.now());
            failure.setStatus(sent ? "RESOLVED" : "FAILED");
            if (!sent) failure.setErrorMessage("Email provider rejected delivery or is not configured");
        } catch (Exception ex) {
            failure.setAttempts(failure.getAttempts() + 1);
            failure.setLastAttemptAt(Instant.now());
            failure.setStatus("FAILED");
            String message = ex.getMessage() == null ? "Retry failed" : ex.getMessage();
            failure.setErrorMessage(message.substring(0, Math.min(4000, message.length())));
        }
        return repository.save(failure);
    }

    private NotificationDeliveryFailure retryPolicyDrivenFailure(
            NotificationDeliveryFailureRepository repository,
            NotificationDeliveryFailure failure,
            NotificationPolicy policy,
            EmailService emailService,
            Map<String, String> payload
    ) {
        NotificationDispatcher dispatcher = notificationDispatcherProvider.getIfAvailable();
        NotificationTemplateVersion version = notificationTemplateVersionRepository
                .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                        policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE)
                .orElse(null);
        if (dispatcher == null || version == null) {
            failure.setAttempts(failure.getAttempts() + 1);
            failure.setLastAttemptAt(Instant.now());
            failure.setStatus("FAILED");
            failure.setErrorMessage("No active EMAIL template version is configured for this policy-driven event");
            return repository.save(failure);
        }
        try {
            String subject = dispatcher.render(version.getSubject(), payload);
            String body = dispatcher.render(version.getBody(), payload);
            boolean sent = StringUtils.hasText(subject) && StringUtils.hasText(body)
                    && sendRenderedEmailWithRetry(emailService, failure.getRecipient(), subject, body);
            failure.setAttempts(failure.getAttempts() + 1);
            failure.setLastAttemptAt(Instant.now());
            failure.setStatus(sent ? "RESOLVED" : "FAILED");
            if (!sent) failure.setErrorMessage("Email provider rejected delivery or is not configured");
        } catch (Exception ex) {
            failure.setAttempts(failure.getAttempts() + 1);
            failure.setLastAttemptAt(Instant.now());
            failure.setStatus("FAILED");
            String message = ex.getMessage() == null ? "Retry failed" : ex.getMessage();
            failure.setErrorMessage(message.substring(0, Math.min(4000, message.length())));
        }
        return repository.save(failure);
    }

    private Map<String, String> readPayload(String payloadJson) {
        try {
            return objectMapper.readValue(payloadJson, objectMapper.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, String.class));
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    /** A workflow event already delivered through NotificationDispatcher must not create a
     * second inbox item via its legacy email template. */
    private boolean isPolicyManaged(Map<String, String> variables) {
        return variables != null && (Boolean.parseBoolean(variables.get("notificationPolicyManaged"))
                || StringUtils.hasText(variables.get("notificationEventCode")));
    }

    private void dispatchPolicyNotification(UserAccount recipient, Map<String, String> variables) {
        if (recipient == null || variables == null) {
            return;
        }
        String eventCode = variables.get("notificationEventCode");
        if (!StringUtils.hasText(eventCode)) {
            return;
        }
        NotificationDispatcher dispatcher = notificationDispatcherProvider.getIfAvailable();
        if (dispatcher != null) {
            dispatcher.dispatch(eventCode, List.of(recipient), variables);
        }
    }

    private String resolveModuleName(String normalizedType) {
        if (!StringUtils.hasText(normalizedType)) {
            return "System";
        }
        String lower = normalizedType.toLowerCase(Locale.ROOT);
        if (lower.contains("controlled-copy") || lower.contains("controlled copy")) {
            return "Controlled Copies";
        }
        if (lower.contains("training")) {
            return "Training";
        }
        if (lower.contains("capa")) {
            return "CAPA";
        }
        if (lower.contains("deviation")) {
            return "Deviation";
        }
        if (lower.contains("change")) {
            return "Change Control";
        }
        if (lower.contains("document")) {
            return "Document";
        }
        return "System";
    }

    private String resolveModuleKey(String normalizedType) {
        return NotificationPreferenceUtils.normalizeModuleKey(resolveModuleName(normalizedType));
    }

    private String resolveScope(String normalizedType) {
        if (!StringUtils.hasText(normalizedType)) {
            return "personal";
        }
        String lower = normalizedType.toLowerCase(Locale.ROOT);
        return lower.contains("system") ? "system" : "personal";
    }

    private List<String> resolveRecipientEmails(UserAccount recipient) {
        if (recipient == null || !recipient.isEmailNotificationsEnabled()) {
            return List.of();
        }

        if (!StringUtils.hasText(recipient.getEmail())) {
            return List.of();
        }
        return List.of(recipient.getEmail().trim());
    }

    private Map<String, String> buildUserVariables(UserAccount recipient, UserAccount actor, Map<String, String> variables) {
        Map<String, String> merged = new LinkedHashMap<>();
        UserAccount target = recipient != null ? recipient : actor;
        String fullName = target != null && StringUtils.hasText(target.getFullName()) ? target.getFullName() : "";
        String email = target != null && StringUtils.hasText(target.getEmail()) ? target.getEmail() : "";
        String currentDateTime = DateTimeFormatUtils.formatDateTime(Instant.now());
        String currentDate = currentDateTime != null && currentDateTime.contains(" ") ? currentDateTime.split(" ", 2)[0] : currentDateTime;
        String currentTime = currentDateTime != null && currentDateTime.contains(" ") ? currentDateTime.split(" ", 2)[1] : currentDateTime;
        merged.put("userName", fullName);
        merged.put("fullName", fullName);
        merged.put("displayName", fullName);
        merged.put("userEmail", email);
        merged.put("username", target != null && StringUtils.hasText(target.getUsername()) ? target.getUsername() : "");
        merged.put("employeeCode", target != null && StringUtils.hasText(target.getEmployeeCode()) ? target.getEmployeeCode() : "");
        merged.put("userRole", target != null && StringUtils.hasText(target.getRoleName()) ? target.getRoleName() : "");
        merged.put("userDepartment", target != null && StringUtils.hasText(target.getDepartment()) ? target.getDepartment() : "");
        merged.put("userPosition", target != null && StringUtils.hasText(target.getPosition()) ? target.getPosition() : "");
        merged.put("businessUnit", target != null && StringUtils.hasText(target.getBusinessUnit()) ? target.getBusinessUnit() : "");
        merged.put("actorName", actor != null && StringUtils.hasText(actor.getFullName()) ? actor.getFullName() : "");
        merged.put("actorEmail", actor != null && StringUtils.hasText(actor.getEmail()) ? actor.getEmail() : "");
        merged.put("actorRole", actor != null && StringUtils.hasText(actor.getRoleName()) ? actor.getRoleName() : "");
        merged.put("recipientName", fullName);
        merged.put("recipientEmail", email);
        merged.put("systemName", "EQMS");
        merged.put("companyName", "EQMS");
        merged.put("currentDate", currentDate != null ? currentDate : "");
        merged.put("currentTime", currentTime != null ? currentTime : "");
        merged.put("currentDateTime", currentDateTime != null ? currentDateTime : "");
        if (variables != null) {
            variables.forEach((key, value) -> {
                if (StringUtils.hasText(key)) {
                    merged.put(key, value);
                }
            });
        }
        return merged;
    }

    private String formatDate(java.time.LocalDate value) {
        return DateTimeFormatUtils.formatDate(value);
    }

    /**
     * copy.getDistributionBatch() is a LAZY @ManyToOne -- notifyControlledCopyStakeholders() is
     * invoked from ControlledCopyNotificationAsyncService on a separate thread, after the
     * originating transaction/Hibernate session has already closed. Actually reading the
     * association's fields (getBatchNumber()) there throws LazyInitializationException ("no
     * session"), which was silently swallowed by the caller's try/catch -- so the FULL email
     * (recipient/copy status/everything) never sent at all, not just this one field. Catch it
     * locally so a batch-number lookup failure degrades to a blank value instead of losing the
     * whole notification.
     */
    private String safeBatchNumber(ControlledCopyRecord copy) {
        try {
            return copy.getDistributionBatch() == null ? "" : value(copy.getDistributionBatch().getBatchNumber());
        } catch (RuntimeException ex) {
            log.debug("Distribution batch not loaded for controlled copy {}; leaving batchNumber blank: {}",
                    copy.getControlledCopyNumber(), ex.getMessage());
            return "";
        }
    }

    /** Date-only (dd/MM/yyyy) rendering of an Instant, in the system zone. */
    private String formatInstantAsDate(Instant value) {
        return value == null ? "" : DateTimeFormatUtils.formatDate(
                java.time.LocalDate.ofInstant(value, java.time.ZoneId.systemDefault()));
    }

    private String formatDateTime(Instant value) {
        return DateTimeFormatUtils.formatDateTime(value);
    }

    private String value(String value) {
        return value == null ? "" : value;
    }

    /**
     * The {@code {{workflowAction}}} placeholder is rendered directly into the
     * controlled-copy-notification email subject/body ("Controlled Copy CC-0001 - {{workflowAction}}",
     * "Action: {{workflowAction}}") -- raw internal action codes like REPLACE_LOST_DAMAGED or
     * REPORT_DAMAGED must never reach a recipient's inbox verbatim. Unknown/future codes fall back
     * to a title-cased, underscore-stripped rendering rather than throwing, so a missing mapping
     * degrades to "Replace Lost Damaged" instead of a raw code or a blank subject.
     */
    private String humanizeControlledCopyAction(String action) {
        if (action == null || action.isBlank()) {
            return "";
        }
        return switch (action.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "DISTRIBUTE" -> "Distributed";
            case "PRINT" -> "Printed";
            case "RECALL" -> "Recalled";
            case "CANCEL" -> "Cancelled";
            case "REPLACE_LOST_DAMAGED" -> "Replacement Issued";
            case "REPORT_LOST" -> "Reported Lost";
            case "REPORT_DAMAGED" -> "Reported Damaged";
            case "DESTROY" -> "Destroyed";
            case "OBSOLETE" -> "Obsoleted";
            default -> java.util.Arrays.stream(action.trim().split("_"))
                    .filter(word -> !word.isBlank())
                    .map(word -> word.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + word.substring(1).toLowerCase(java.util.Locale.ROOT))
                    .collect(java.util.stream.Collectors.joining(" "));
        };
    }

    private String nullSafe(UserAccount user) {
        return user == null ? "" : value(user.getFullName());
    }

    private String buildDocumentUrl(DocumentRecord document) {
        if (document == null || document.getId() == null) {
            return "";
        }
        return "/documents/" + document.getId();
    }

    private String buildRevisionUrl(DocumentRevisionRecord revision) {
        if (revision == null || revision.getId() == null) {
            return "";
        }
        return "/documents/revisions/edit/" + revision.getId();
    }
}
