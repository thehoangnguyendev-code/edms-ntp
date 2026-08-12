package com.eqms.service;

import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserNotification;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.UserNotificationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2: {@code escalationEnabled}/{@code
 * escalationAfterMinutes}/{@code escalationRecipientRules} on {@link NotificationPolicy} were
 * schema+API-complete but nothing ever read them -- an admin turning escalation on had no
 * observable effect. Runs every 10 minutes; re-dispatches the *same* event (same rendered
 * content, reconstructed from the original notification's stored {@code metadata} variables
 * snapshot) to the policy's escalation audience, so the escalation message is recognizably "the
 * same thing, now also sent to X" rather than a separately-worded alert.
 */
@Service
public class NotificationEscalationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationEscalationScheduler.class);

    private final UserNotificationRepository userNotificationRepository;
    private final NotificationPolicyRepository policyRepository;
    private final NotificationDispatcher notificationDispatcher;
    private final DistributedSchedulerLockService schedulerLockService;

    public NotificationEscalationScheduler(
            UserNotificationRepository userNotificationRepository,
            NotificationPolicyRepository policyRepository,
            NotificationDispatcher notificationDispatcher,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.userNotificationRepository = userNotificationRepository;
        this.policyRepository = policyRepository;
        this.notificationDispatcher = notificationDispatcher;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 */10 * * * *")
    @Transactional
    public void escalateOverdueUnread() {
        try (var lease = schedulerLockService.tryAcquire("notification-escalation", Duration.ofMinutes(8))) {
            if (!lease.acquired()) {
                log.warn("Skipping notification escalation scheduler because another instance owns the lease or Redis is unavailable");
                return;
            }
            List<UserNotification> candidates = userNotificationRepository
                    .findAllByStatusIgnoreCaseAndEscalatedAtIsNullAndDeletedAtIsNull(UserNotification.STATUS_UNREAD);
            Instant now = Instant.now();
            for (UserNotification notification : candidates) {
                escalateIfDue(notification, now);
            }
        } catch (Exception e) {
            log.error("Notification escalation scheduler run failed", e);
        }
    }

    private void escalateIfDue(UserNotification notification, Instant now) {
        NotificationPolicy policy = policyRepository.findByEventCode(notification.getType()).orElse(null);
        if (policy == null || !policy.isEscalationEnabled() || policy.getEscalationAfterMinutes() == null) {
            return;
        }
        if (notification.getCreatedAt() == null
                || notification.getCreatedAt().plus(Duration.ofMinutes(policy.getEscalationAfterMinutes())).isAfter(now)) {
            return;
        }

        List<UserAccount> escalationRecipients = notificationDispatcher.resolveRecipients(
                policy.getEscalationRecipientRules(), List.of());
        if (escalationRecipients.isEmpty()) {
            log.warn("Escalation due for notification {} (event '{}') but no escalation recipients resolved.",
                    notification.getId(), notification.getType());
            notification.setEscalatedAt(now);
            userNotificationRepository.save(notification);
            return;
        }

        notificationDispatcher.dispatch(notification.getType(), escalationRecipients, metadataToVariables(notification.getMetadata()));
        notification.setEscalatedAt(now);
        userNotificationRepository.save(notification);
    }

    private Map<String, String> metadataToVariables(JsonNode metadata) {
        Map<String, String> variables = new LinkedHashMap<>();
        if (metadata == null || !metadata.isObject()) {
            return variables;
        }
        metadata.fields().forEachRemaining(entry -> variables.put(entry.getKey(), entry.getValue().asText("")));
        return variables;
    }
}
