package com.eqms.service;

import com.eqms.entity.NotificationDispatchQueue;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.NotificationDispatchQueueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Consumer side of NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md Phase 2's digest/quiet-hours
 * deferral: {@link NotificationDispatcher} queues EMAIL (and, once wired, TELEGRAM/WHATSAPP)
 * sends into {@code notification_dispatch_queue} instead of sending immediately when a policy's
 * digestMode isn't IMMEDIATE or the send falls inside quiet hours. This runs hourly, groups
 * everything due by (recipient, channel), and sends one combined message per group -- content
 * was already fully rendered at dispatch time, so no template/variable resolution happens here.
 */
@Service
public class NotificationDigestScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationDigestScheduler.class);

    private final NotificationDispatchQueueRepository queueRepository;
    private final EmailNotificationService emailNotificationService;
    private final DistributedSchedulerLockService schedulerLockService;

    public NotificationDigestScheduler(
            NotificationDispatchQueueRepository queueRepository,
            EmailNotificationService emailNotificationService,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.queueRepository = queueRepository;
        this.emailNotificationService = emailNotificationService;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void sendDueDigests() {
        try (var lease = schedulerLockService.tryAcquire("notification-digest", Duration.ofMinutes(20))) {
            if (!lease.acquired()) {
                log.warn("Skipping notification digest scheduler because another instance owns the lease or Redis is unavailable");
                return;
            }
            List<NotificationDispatchQueue> due = queueRepository
                    .findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
                            NotificationDispatchQueue.STATUS_PENDING, Instant.now());
            if (due.isEmpty()) {
                return;
            }

            Map<String, List<NotificationDispatchQueue>> grouped = new LinkedHashMap<>();
            for (NotificationDispatchQueue item : due) {
                if (item.getRecipient() == null || item.getRecipient().getId() == null) {
                    continue;
                }
                String key = item.getRecipient().getId() + "|" + item.getChannel();
                grouped.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(item);
            }

            for (List<NotificationDispatchQueue> group : grouped.values()) {
                sendGroup(group);
            }
        } catch (Exception e) {
            log.error("Notification digest scheduler run failed", e);
        }
    }

    private void sendGroup(List<NotificationDispatchQueue> group) {
        NotificationDispatchQueue first = group.get(0);
        UserAccount recipient = first.getRecipient();
        String channel = first.getChannel();

        if (!NotificationTemplateVersion.CHANNEL_EMAIL.equals(channel)) {
            log.warn("Notification digest scheduler has no sender for channel '{}' yet -- {} item(s) left PENDING for {}.",
                    channel, group.size(), recipient.getId());
            return;
        }
        if (!StringUtils.hasText(recipient.getEmail()) || !recipient.isEmailNotificationsEnabled()) {
            group.forEach(item -> item.setStatus(NotificationDispatchQueue.STATUS_CANCELLED));
            queueRepository.saveAll(group);
            return;
        }

        String subject = group.size() == 1
                ? first.getRenderedSubject()
                : "You have " + group.size() + " new updates";
        StringBuilder body = new StringBuilder();
        if (group.size() > 1) {
            body.append("<p>Here is a summary of your recent notifications:</p>");
        }
        for (NotificationDispatchQueue item : group) {
            if (group.size() > 1) {
                body.append("<hr/><h4>").append(escapeHtml(item.getRenderedSubject())).append("</h4>");
            }
            body.append(item.getRenderedBody());
        }

        boolean sent = emailNotificationService.sendRenderedEmailWithTracking(
                recipient.getEmail(), subject, body.toString(), first.getEventCode(), "digest", Map.of());

        Instant now = Instant.now();
        for (NotificationDispatchQueue item : group) {
            item.setAttempts(item.getAttempts() + 1);
            item.setStatus(sent ? NotificationDispatchQueue.STATUS_SENT : NotificationDispatchQueue.STATUS_FAILED);
            item.setSentAt(sent ? now : null);
        }
        queueRepository.saveAll(group);
    }

    private String escapeHtml(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
