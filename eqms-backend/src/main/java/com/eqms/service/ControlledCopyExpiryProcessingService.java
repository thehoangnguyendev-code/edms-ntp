package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Per-copy work for {@link ControlledCopyExpiryScheduler}, each call its own transaction --
 * previously the whole nightly run (every due reminder AND every expired copy, system-wide) was
 * one single transaction: one slow copy (or a mid-run DB hiccup) rolled back every other copy
 * already processed that night, silently redoing tomorrow what should have finished tonight.
 */
@Service
public class ControlledCopyExpiryProcessingService {

    private static final String STATUS_DISTRIBUTED = "DISTRIBUTED";
    private static final String STATUS_OBSOLETED = "OBSOLETED";
    private static final String OBSOLETE_REASON_EXPIRED = "EXPIRED";

    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    private final ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository;
    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final EmailNotificationService emailNotificationService;
    private final AuditTrailService auditTrailService;
    private final ApplicationEventPublisher eventPublisher;
    private final SystemActorProvider systemActorProvider;

    public ControlledCopyExpiryProcessingService(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            EmailNotificationService emailNotificationService,
            AuditTrailService auditTrailService,
            ApplicationEventPublisher eventPublisher,
            SystemActorProvider systemActorProvider
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.controlledCopyDistributionBatchRepository = controlledCopyDistributionBatchRepository;
        this.controlledCopyStatusDefinitionRepository = controlledCopyStatusDefinitionRepository;
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.emailNotificationService = emailNotificationService;
        this.auditTrailService = auditTrailService;
        this.eventPublisher = eventPublisher;
        this.systemActorProvider = systemActorProvider;
    }

    @Transactional
    public void sendReminderForCopy(java.util.UUID copyId) {
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId).orElse(null);
        // Re-check eligibility: another concurrent action may have moved the copy on since the
        // scheduler's read-only listing query ran.
        if (copy == null || copy.getExpiryDate() == null || copy.getExpiryReminderSentAt() != null
                || !STATUS_DISTRIBUTED.equalsIgnoreCase(normalize(copy.getStatusCode()))) {
            return;
        }
        Instant now = Instant.now();
        UserAccount systemActor = resolveSystemActor();

        Map<String, UserAccount> recipientsByKey = new java.util.LinkedHashMap<>();
        if (copy.getRecipientUser() != null) {
            recipientsByKey.put(recipientKey(copy.getRecipientUser()), copy.getRecipientUser());
        }
        for (UserAccount dcoUser : resolveDcoUsers()) {
            recipientsByKey.put(recipientKey(dcoUser), dcoUser);
        }
        List<UserAccount> recipients = recipientsByKey.values().stream().toList();

        Map<String, String> variables = emailNotificationService.buildControlledCopyVariables(
                copy,
                systemActor,
                copy.getRecipientUser() != null ? copy.getRecipientUser() : systemActor,
                "EXPIRY_REMINDER",
                "Expiry date approaching",
                Map.of(
                        "executionDate", DateTimeFormatUtils.formatDateTime(now),
                        "expiryDate", DateTimeFormatUtils.formatDateTime(copy.getExpiryDate())
                )
        );
        if (!recipients.isEmpty()) {
            emailNotificationService.sendControlledCopyNotification("controlled-copy-expiry-notification", recipients, variables);
        }
        if (copy.getRecipientUser() == null) {
            // External copies have no internal login account -- the recipient is only an e-mail
            // address. Without this, an externally-distributed copy never gets an expiry reminder
            // at all (only the internal DCO users above would, if any are configured).
            String recipientEmail = normalizeEmail(copy.getRecipientName());
            if (isValidEmailAddress(recipientEmail)) {
                emailNotificationService.sendControlledCopyNotificationToEmails(
                        "controlled-copy-expiry-notification", List.of(recipientEmail), variables);
            }
        }

        copy.setExpiryReminderSentAt(now);
        controlledCopyRepository.save(copy);
        auditTrailService.logAs(
                systemActor,
                "Controlled Copy",
                copy.getControlledCopyNumber(),
                copy.getId(),
                "EXPIRY_REMINDER",
                copy.getStatus(),
                copy.getStatus(),
                "Expiry reminder sent for copy expiring on " + DateTimeFormatUtils.formatDateTime(copy.getExpiryDate()),
                List.of(new AuditTrailChangeResponse("expiryDate", "", DateTimeFormatUtils.formatDateTime(copy.getExpiryDate()))),
                null
        );
    }

    @Transactional
    public void obsoleteExpiredCopy(java.util.UUID copyId) {
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId).orElse(null);
        if (copy == null || copy.getExpiryDate() == null
                || STATUS_OBSOLETED.equalsIgnoreCase(normalize(copy.getStatusCode()))) {
            return;
        }

        Instant now = Instant.now();
        UserAccount systemActor = resolveSystemActor();
        String fromStatus = copy.getStatus();
        copy.setStatusCode(STATUS_OBSOLETED);
        copy.setStatus("Obsoleted");
        controlledCopyStatusDefinitionRepository.findById(STATUS_OBSOLETED)
                .ifPresent(status -> copy.setStatus(StringUtils.hasText(status.getLabel()) ? status.getLabel() : "Obsoleted"));
        copy.setCurrentStage("Obsoleted");
        copy.setObsoleteReason(OBSOLETE_REASON_EXPIRED);
        copy.setObsoletedBy(systemActor);
        copy.setObsoletedAt(now);
        controlledCopyRepository.saveAndFlush(copy);
        updateRelatedBatch(copy, systemActor, now);

        String comment = buildExpiryAuditComment(copy, now);
        auditTrailService.logAs(
                systemActor,
                "Controlled Copy",
                copy.getControlledCopyNumber(),
                copy.getId(),
                "OBSOLETE",
                fromStatus,
                "Obsoleted",
                comment,
                // Only "status" is an actual transition here -- expiryDate does not change when a
                // copy is auto-obsoleted for having reached it, so recording it as
                // "<date> -> <date>" was a no-op row that told an inspector nothing.
                List.of(
                        new AuditTrailChangeResponse("status", fromStatus == null ? "" : fromStatus, "Obsoleted")
                ),
                null
        );
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        // Reuses the exact same "OBSOLETE" action/template as the Revision/Document cascade case
        // (ControlledCopyLifecycleObsolescenceService) since this is the same underlying event from
        // the recipient's point of view: their copy became invalid through no action of their own,
        // not because someone specifically Recalled it.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(
                copy.getId(), systemActor == null ? null : systemActor.getId(), "OBSOLETE", comment, null));
    }

    private UserAccount resolveSystemActor() {
        // Reserved SYSTEM account (V413) -- this scheduler runs with no human in the loop, so the
        // audit trail and the obsoleted_by FK must read "system", not a real admin user.
        return systemActorProvider.get();
    }

    private List<UserAccount> resolveDcoUsers() {
        // Notification recipients are entitlement-based. A display role such as "DCO" is
        // tenant-configurable and must never be the source of access or notification eligibility.
        return userAccountRepository.findAllByStatus(UserStatus.Active).stream()
                .filter(user -> user != null)
                .filter(user -> permissionEvaluationService.hasPermission(user, "documents.workspace.manage"))
                .toList();
    }

    private void updateRelatedBatch(ControlledCopyRecord copy, UserAccount systemActor, Instant executionDate) {
        ControlledCopyDistributionBatch batch = copy.getDistributionBatch();
        if (batch == null || STATUS_OBSOLETED.equalsIgnoreCase(normalize(batch.getStatusCode()))) {
            return;
        }
        batch.setStatusCode(STATUS_OBSOLETED);
        batch.setStatus("Obsoleted");
        controlledCopyStatusDefinitionRepository.findById(STATUS_OBSOLETED)
                .ifPresent(status -> batch.setStatus(StringUtils.hasText(status.getLabel()) ? status.getLabel() : "Obsoleted"));
        controlledCopyDistributionBatchRepository.save(batch);
        auditTrailService.logAs(
                systemActor,
                "Controlled Copy Distribution Batch",
                batch.getBatchNumber(),
                batch.getId(),
                "OBSOLETE",
                "Distributed",
                "Obsoleted",
                "Controlled Copy Automatically Obsoleted; Reason: Expiry Date Reached; Batch Number: " + batch.getBatchNumber()
                        + "; Expiry Date: " + DateTimeFormatUtils.formatDateTime(batch.getExpiryDate())
                        + "; Execution Date: " + DateTimeFormatUtils.formatDateTime(executionDate),
                List.of(new AuditTrailChangeResponse("status", "Distributed", "Obsoleted")),
                null
        );
    }

    private String buildExpiryAuditComment(ControlledCopyRecord copy, Instant executionDate) {
        return "Controlled Copy Automatically Obsoleted; Reason: Expiry Date Reached; "
                + "Copy Number: " + (copy == null ? "" : String.valueOf(copy.getCopyNumber()))
                + "; Document: " + (copy == null ? "" : StringUtils.trimWhitespace(copy.getDocumentNumber()))
                + "; Revision: " + (copy == null ? "" : StringUtils.trimWhitespace(copy.getRevisionNumber()))
                + "; Expiry Date: " + DateTimeFormatUtils.formatDateTime(copy == null ? null : copy.getExpiryDate())
                + "; Execution Date: " + DateTimeFormatUtils.formatDateTime(executionDate);
    }

    private String recipientKey(UserAccount user) {
        if (user == null) {
            return "";
        }
        if (user.getId() != null) {
            return user.getId().toString();
        }
        if (StringUtils.hasText(user.getEmail())) {
            return user.getEmail().trim().toLowerCase(Locale.ROOT);
        }
        return StringUtils.hasText(user.getUsername()) ? user.getUsername().trim().toLowerCase(Locale.ROOT) : "";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeEmail(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : null;
    }

    private boolean isValidEmailAddress(String email) {
        return StringUtils.hasText(email) && email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }
}
