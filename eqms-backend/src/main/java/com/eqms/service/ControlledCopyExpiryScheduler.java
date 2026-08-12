package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.DateTimeFormatUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ControlledCopyExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyExpiryScheduler.class);
    private static final String STATUS_DISTRIBUTED = "DISTRIBUTED";
    private static final String STATUS_OBSOLETED = "OBSOLETED";
    private static final String OBSOLETE_REASON_EXPIRED = "EXPIRED";
    private static final ZoneId SYSTEM_ZONE = ZoneId.systemDefault();

    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    private final ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository;
    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final EmailNotificationService emailNotificationService;
    private final AuditTrailService auditTrailService;
    private final DistributedSchedulerLockService schedulerLockService;

    public ControlledCopyExpiryScheduler(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            EmailNotificationService emailNotificationService,
            AuditTrailService auditTrailService,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.controlledCopyDistributionBatchRepository = controlledCopyDistributionBatchRepository;
        this.controlledCopyStatusDefinitionRepository = controlledCopyStatusDefinitionRepository;
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.emailNotificationService = emailNotificationService;
        this.auditTrailService = auditTrailService;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void runDailyExpiryProcessing() {
        try (var lease = schedulerLockService.tryAcquire("controlled-copy-expiry", Duration.ofMinutes(30))) {
            if (!lease.acquired()) {
                log.warn("Skipping controlled-copy expiry scheduler because another instance owns the lease or Redis is unavailable");
                return;
            }
            sendExpiryReminders();
            autoObsoleteExpiredControlledCopies();
        }
    }

    @Transactional
    public void sendExpiryReminders() {
        Instant now = Instant.now();
        Instant reminderStart = now.plusSeconds(7L * 24 * 60 * 60);
        Instant reminderEnd = reminderStart.plusSeconds(24 * 60 * 60);

        List<ControlledCopyRecord> due = controlledCopyRepository
                .findAllByStatusCodeAndHasExpiryDateTrueAndExpiryReminderSentAtIsNullAndExpiryDateBetween(
                        STATUS_DISTRIBUTED,
                        reminderStart,
                        reminderEnd
                );
        if (due.isEmpty()) {
            return;
        }

        UserAccount systemActor = resolveSystemActor();
        List<UserAccount> dcoUsers = resolveDcoUsers();

        for (ControlledCopyRecord copy : due) {
            if (copy == null || copy.getExpiryDate() == null) {
                continue;
            }

            Map<String, UserAccount> recipientsByKey = new java.util.LinkedHashMap<>();
            if (copy.getRecipientUser() != null) {
                recipientsByKey.put(recipientKey(copy.getRecipientUser()), copy.getRecipientUser());
            }
            for (UserAccount dcoUser : dcoUsers) {
                recipientsByKey.put(recipientKey(dcoUser), dcoUser);
            }
            List<UserAccount> recipients = recipientsByKey.values().stream().toList();

            if (!recipients.isEmpty()) {
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
                emailNotificationService.sendControlledCopyNotification("controlled-copy-expiry-notification", recipients, variables);
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
                    List.of(new AuditTrailChangeResponse("expiryDate", "", DateTimeFormatUtils.formatDateTime(copy.getExpiryDate())))
            );
        }
    }

    @Transactional
    public void autoObsoleteExpiredControlledCopies() {
        Instant now = Instant.now();
        List<ControlledCopyRecord> expired = controlledCopyRepository
                .findAllByStatusCodeAndHasExpiryDateTrueAndExpiryDateLessThanEqual(STATUS_DISTRIBUTED, now);
        if (expired.isEmpty()) {
            return;
        }

        UserAccount systemActor = resolveSystemActor();
        for (ControlledCopyRecord copy : expired) {
            if (copy == null || copy.getExpiryDate() == null) {
                continue;
            }
            if (STATUS_OBSOLETED.equalsIgnoreCase(normalize(copy.getStatusCode()))) {
                continue;
            }

            String fromStatus = copy.getStatus();
            copy.setStatusCode(STATUS_OBSOLETED);
            copy.setStatus("Obsoleted");
            controlledCopyStatusDefinitionRepository.findById(STATUS_OBSOLETED)
                    .ifPresent(status -> copy.setStatus(StringUtils.hasText(status.getLabel()) ? status.getLabel() : "Obsoleted"));
            copy.setCurrentStage("Obsoleted");
            copy.setObsoleteReason(OBSOLETE_REASON_EXPIRED);
            copy.setObsoletedBy(systemActor);
            copy.setObsoletedAt(now);
            controlledCopyRepository.save(copy);
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
                    List.of(
                            new AuditTrailChangeResponse("status", fromStatus == null ? "" : fromStatus, "Obsoleted"),
                            new AuditTrailChangeResponse("expiryDate", DateTimeFormatUtils.formatDateTime(copy.getExpiryDate()), DateTimeFormatUtils.formatDateTime(copy.getExpiryDate()))
                    )
            );
        }
    }

    private UserAccount resolveSystemActor() {
        return userAccountRepository.findByUsername("admin").orElse(null);
    }

    private List<UserAccount> resolveDcoUsers() {
        // Notification recipients are entitlement-based.  A display role such as
        // "DCO" is tenant-configurable and must never be the source of access or
        // notification eligibility.
        return userAccountRepository.findAllByStatus(UserStatus.Active).stream()
                .filter(user -> user != null)
                .filter(user -> permissionEvaluationService.hasPermission(user, "documents.workspace.manage"))
                .toList();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
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

    private void updateRelatedBatch(ControlledCopyRecord copy, UserAccount systemActor, Instant executionDate) {
        if (copy == null) {
            return;
        }
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
                List.of(new AuditTrailChangeResponse("status", "Distributed", "Obsoleted"))
        );
    }
}

