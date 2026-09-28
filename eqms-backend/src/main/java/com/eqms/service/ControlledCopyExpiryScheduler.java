package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.ControlledCopyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Orchestrates the nightly Controlled Copy expiry run -- listing which copies are due is
 * read-only here; the actual per-copy mutation (and its notification) happens one copy, one
 * transaction at a time in {@link ControlledCopyExpiryProcessingService}. Previously the whole
 * night's work (every due reminder AND every expired copy, system-wide) was one single
 * transaction: a mid-run DB hiccup rolled back every copy already processed that night, and one
 * slow copy held the connection for the whole run.
 */
@Service
public class ControlledCopyExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyExpiryScheduler.class);
    private static final String STATUS_DISTRIBUTED = "DISTRIBUTED";

    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyExpiryProcessingService processingService;
    private final DistributedSchedulerLockService schedulerLockService;

    public ControlledCopyExpiryScheduler(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyExpiryProcessingService processingService,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.processingService = processingService;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 0 2 * * *")
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

    public void sendExpiryReminders() {
        Instant now = Instant.now();
        Instant reminderStart = now.plusSeconds(7L * 24 * 60 * 60);
        Instant reminderEnd = reminderStart.plusSeconds(24 * 60 * 60);

        List<UUID> dueCopyIds = listDueReminderCopyIds(reminderStart, reminderEnd);
        for (UUID copyId : dueCopyIds) {
            try {
                processingService.sendReminderForCopy(copyId);
            } catch (Exception ex) {
                log.warn("Failed to send expiry reminder for controlled copy {}: {}", copyId, ex.getMessage(), ex);
            }
        }
    }

    public void autoObsoleteExpiredControlledCopies() {
        Instant now = Instant.now();
        List<UUID> expiredCopyIds = listExpiredCopyIds(now);
        for (UUID copyId : expiredCopyIds) {
            try {
                processingService.obsoleteExpiredCopy(copyId);
            } catch (Exception ex) {
                log.warn("Failed to auto-obsolete expired controlled copy {}: {}", copyId, ex.getMessage(), ex);
            }
        }
    }

    @Transactional(readOnly = true)
    protected List<UUID> listDueReminderCopyIds(Instant reminderStart, Instant reminderEnd) {
        return controlledCopyRepository
                .findAllByStatusCodeAndHasExpiryDateTrueAndExpiryReminderSentAtIsNullAndExpiryDateBetween(
                        STATUS_DISTRIBUTED, reminderStart, reminderEnd)
                .stream()
                .map(ControlledCopyRecord::getId)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @Transactional(readOnly = true)
    protected List<UUID> listExpiredCopyIds(Instant now) {
        return controlledCopyRepository
                .findAllByStatusCodeAndHasExpiryDateTrueAndExpiryDateLessThanEqual(STATUS_DISTRIBUTED, now)
                .stream()
                .map(ControlledCopyRecord::getId)
                .filter(java.util.Objects::nonNull)
                .toList();
    }
}
