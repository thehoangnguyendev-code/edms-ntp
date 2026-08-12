package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.EmailTemplate;
import com.eqms.entity.UserAccount;
import com.eqms.entity.NotificationDeliveryFailure;
import com.eqms.repository.EmailTemplateRepository;
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
                    recordDeliveryFailure(
                            recipientEmail,
                            normalizedType,
                            "CONTROLLED_COPY",
                            new IllegalStateException("Email provider rejected delivery or is not configured"), payload
                    );
                    log.warn(
                            "Email template '{}' was not sent to {} because email notifications are disabled or SMTP is not configured.",
                            template.getName(),
                            recipientEmail
                    );
                }
            } catch (Exception ex) {
                recordDeliveryFailure(recipientEmail, normalizedType, "CONTROLLED_COPY", ex, payload);
                log.warn("Failed to send '{}' controlled copy notification to {}: {}", normalizedType, recipientEmail, ex.getMessage(), ex);
            }
        }
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
            merged.put("workflowStage", value(copy.getCurrentStage()));
            merged.put("workflowAction", value(action));
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
            merged.put("workflowAction", value(action));
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
        return baseUrl + "/documents/controlled-copies/preview/" + copy.getId() + "?token=" + token;
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
            String moduleKey = resolveModuleKey(normalizedType);
            Map<String, String> payload = buildUserVariables(recipient, null, variables);
            dispatchPolicyNotification(recipient, payload);
            if (!isPolicyManaged(variables) && NotificationPreferenceUtils.canReceiveInAppNotification(objectMapper, recipient, moduleKey)) {
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
                if (!NotificationPreferenceUtils.canReceiveEmailNotification(objectMapper, recipient, moduleKey)) {
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
                        recordDeliveryFailure(
                                recipientEmail,
                                normalizedType,
                                eventDomain,
                                new IllegalStateException("Email provider rejected delivery or is not configured"), emailPayload
                        );
                        log.warn("Email template '{}' was not sent to {} because email notifications are disabled or SMTP is not configured.", template.getName(), recipientEmail);
                    }
                }
            } catch (Exception ex) {
                recordDeliveryFailure(recipient.getEmail(), normalizedType, eventDomain, ex, variables);
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
        try {
            boolean sent = sendRenderedEmailWithRetry(emailService, recipientEmail, subject, body);
            if (!sent) {
                recordDeliveryFailure(recipientEmail, eventCode, eventDomain,
                        new IllegalStateException("Email provider rejected delivery or is not configured"), payload);
                log.warn("Policy-driven email '{}' was not sent to {} because email notifications are disabled or SMTP is not configured.", eventCode, recipientEmail);
            }
            return sent;
        } catch (Exception ex) {
            recordDeliveryFailure(recipientEmail, eventCode, eventDomain, ex, payload);
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
        EmailTemplate template = templateRepository
                .findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(failure.getNotificationType(), "Active")
                .orElseThrow(() -> new IllegalStateException("No active email template is available for this notification"));
        EmailService emailService = emailServiceProvider.getIfAvailable();
        if (emailService == null) throw new IllegalStateException("Email service is unavailable");
        try {
            Map<String, String> payload = StringUtils.hasText(failure.getPayloadJson())
                    ? objectMapper.readValue(failure.getPayloadJson(), objectMapper.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, String.class))
                    : new LinkedHashMap<>();
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

    private String formatDateTime(Instant value) {
        return DateTimeFormatUtils.formatDateTime(value);
    }

    private String value(String value) {
        return value == null ? "" : value;
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
