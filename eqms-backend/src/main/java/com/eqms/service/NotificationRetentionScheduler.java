package com.eqms.service;

import com.eqms.entity.SystemConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Keeps the in-app notifications from piling up (owner decision 2026-11-12): a notification that was read more than N days ago is deleted, every night. N is
 * {@code inAppRetentionDays} of the notification configuration (Configuration, Notification tab; 180 when it is not set; 0 keeps everything). A notification that was
 * never read is never deleted. It deletes in batches so that a large backlog does not hold the table, and writes one entry to the Audit Trail with how many it removed.
 */
@Service
public class NotificationRetentionScheduler {
    private static final Logger log = LoggerFactory.getLogger(NotificationRetentionScheduler.class);
    public static final int DEFAULT_DAYS = 180;
    /** The smallest period that can be set (0 turns the clean-up off): a typing mistake must not wipe the recent past. */
    public static final int MIN_DAYS = 30;
    public static final int MAX_DAYS = 3650;
    static final int BATCH = 5000;

    private final JdbcTemplate jdbc;
    private final SystemConfigurationService configuration;
    private final AuditTrailService audit;
    private final SystemActorProvider systemActor;
    private final DistributedSchedulerLockService lockService;

    public NotificationRetentionScheduler(JdbcTemplate jdbc, SystemConfigurationService configuration, AuditTrailService audit, SystemActorProvider systemActor,
                                          DistributedSchedulerLockService lockService) {
        this.jdbc = jdbc;
        this.configuration = configuration;
        this.audit = audit;
        this.systemActor = systemActor;
        this.lockService = lockService;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void purge() {
        try (var lease = lockService.tryAcquire("notification-retention", Duration.ofMinutes(30))) {
            if (!lease.acquired()) return;
            run(Instant.now());
        } catch (Exception failure) {
            log.warn("Old notifications were not cleaned up this time: {}", failure.getMessage());
        }
    }

    /** The number of days read notifications are kept, from the configuration; 0 means for ever. */
    int days() {
        try {
            SystemConfiguration config = configuration.requireConfiguration();
            var node = config.getNotificationsConfig() == null ? null : config.getNotificationsConfig().path("inAppRetentionDays");
            if (node == null || node.isMissingNode() || node.isNull() || !node.canConvertToInt()) return DEFAULT_DAYS;
            int days = node.asInt(DEFAULT_DAYS);
            return days < 0 ? DEFAULT_DAYS : days;
        } catch (RuntimeException failure) {
            return DEFAULT_DAYS;
        }
    }

    /** One pass at the given moment; returns how many notifications were deleted. */
    int run(Instant now) {
        int days = days();
        if (days == 0) return 0;
        Instant cutoff = now.minus(Duration.ofDays(days));
        int total = 0;
        while (true) {
            int deleted = jdbc.update("""
                    delete from user_notifications where id in (
                        select id from user_notifications where read_at is not null and read_at < ? limit ?)
                    """, java.sql.Timestamp.from(cutoff), BATCH);
            total += deleted;
            if (deleted < BATCH) break;
        }
        if (total > 0) {
            try {
                audit.logAs(systemActor.get(), "NOTIFICATION", "In-app notifications", null, "RETENTION_PURGE", null, null,
                        "Deleted " + total + " in-app notification(s) that were read more than " + days + " days ago", List.of());
            } catch (RuntimeException failure) {
                log.warn("The clean-up of {} notifications could not be written to the Audit Trail: {}", total, failure.getMessage());
            }
        }
        return total;
    }
}
