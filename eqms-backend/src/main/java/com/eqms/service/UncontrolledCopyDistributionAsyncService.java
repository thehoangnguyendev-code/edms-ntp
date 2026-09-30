package com.eqms.service;

import com.eqms.dto.notification.ControlledCopyBatchProgressEventResponse;
import com.eqms.entity.UncontrolledCopyDistributionJob;
import com.eqms.entity.UncontrolledCopyDistributionJobItem;
import com.eqms.entity.UncontrolledCopyRecord;
import com.eqms.repository.UncontrolledCopyDistributionJobItemRepository;
import com.eqms.repository.UncontrolledCopyDistributionJobRepository;
import com.eqms.repository.UncontrolledCopyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Sends the Uncontrolled Copy distribution e-mail in the background after the Distribute transaction
 * commits, mirroring {@link ControlledCopyBatchDistributionAsyncService}: job/item PENDING -> PROCESSING ->
 * SUCCESS / FAILED / SKIPPED, 3 attempts with backoff, SSE progress to the issuer, and a scheduled reclaim
 * of PENDING jobs after a backend restart. Also owns the scheduled expiry of Distributed copies whose
 * validity window has ended.
 */
@Service
public class UncontrolledCopyDistributionAsyncService {

    private static final Logger log = LoggerFactory.getLogger(UncontrolledCopyDistributionAsyncService.class);
    private static final String EVENT_NAME = "uncontrolled-copy-distribution-progress";
    private static final int MAX_PROCESSING_ATTEMPTS = 3;

    private final UncontrolledCopyService uncontrolledCopyService;
    private final NotificationRealtimeService notificationRealtimeService;
    private final UncontrolledCopyDistributionJobRepository jobRepository;
    private final UncontrolledCopyDistributionJobItemRepository itemRepository;
    private final UncontrolledCopyRepository uncontrolledCopyRepository;
    private final DistributedSchedulerLockService schedulerLockService;
    private final TransactionTemplate transactionTemplate;

    public UncontrolledCopyDistributionAsyncService(
            UncontrolledCopyService uncontrolledCopyService,
            NotificationRealtimeService notificationRealtimeService,
            UncontrolledCopyDistributionJobRepository jobRepository,
            UncontrolledCopyDistributionJobItemRepository itemRepository,
            UncontrolledCopyRepository uncontrolledCopyRepository,
            DistributedSchedulerLockService schedulerLockService,
            PlatformTransactionManager transactionManager
    ) {
        this.uncontrolledCopyService = uncontrolledCopyService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.jobRepository = jobRepository;
        this.itemRepository = itemRepository;
        this.uncontrolledCopyRepository = uncontrolledCopyRepository;
        this.schedulerLockService = schedulerLockService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Async("controlledCopyBatchExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDistributed(UncontrolledCopyDistributedEvent event) {
        processJob(event);
    }

    private void processJob(UncontrolledCopyDistributedEvent event) {
        if (event == null || event.jobId() == null) {
            return;
        }
        UncontrolledCopyDistributionJob job = jobRepository.findById(event.jobId()).orElse(null);
        if (job == null) {
            return;
        }
        List<UncontrolledCopyDistributionJobItem> items = itemRepository.findAllByJob_IdOrderByIdAsc(job.getId()).stream()
                .filter(item -> "PENDING".equals(item.getStatus()) || "PROCESSING".equals(item.getStatus()))
                .toList();
        job.setStatus("PROCESSING");
        if (job.getStartedAt() == null) {
            job.setStartedAt(Instant.now());
        }
        jobRepository.save(job);
        String copyId = event.uncontrolledCopyId() == null ? null : event.uncontrolledCopyId().toString();
        int total = items.size();
        int processed = 0;
        int failed = 0;
        int skipped = 0;
        int succeeded = 0;
        publishProgress(copyId, event.issuerUserId(), processed, total, failed, "in_progress");
        for (UncontrolledCopyDistributionJobItem item : items) {
            item.setStatus("PROCESSING");
            item.setAttempts(item.getAttempts() + 1);
            item.setProcessingStartedAt(Instant.now());
            itemRepository.save(item);
            UncontrolledCopyService.DeliveryOutcome outcome = sendWithRetry(event.uncontrolledCopyId(), item.getRecipientEmail(), event.issuerUserId());
            if (outcome == UncontrolledCopyService.DeliveryOutcome.FAILED) {
                failed++;
                item.setStatus("FAILED");
                item.setLastErrorCode("EMAIL_DELIVERY_FAILED");
                item.setLastErrorMessage("E-mail delivery failed after automatic retries. The copy remains available for in-app download.");
                recordFailure(event, item.getRecipientEmail(), item.getLastErrorMessage());
            } else if (outcome == UncontrolledCopyService.DeliveryOutcome.SKIPPED) {
                skipped++;
                item.setStatus("SKIPPED");
                item.setLastErrorCode(null);
                item.setLastErrorMessage(item.getRecipientEmail() == null
                        ? "Recipient has no e-mail address; the copy is available for in-app download only."
                        : "Uncontrolled copy is no longer Distributed; e-mail not sent.");
            } else {
                succeeded++;
                item.setStatus("SUCCESS");
                item.setLastErrorCode(null);
                item.setLastErrorMessage(null);
            }
            item.setCompletedAt(Instant.now());
            itemRepository.save(item);
            processed++;
            String status = processed == total ? (failed > 0 || skipped > 0 ? "completed_with_errors" : "completed") : "in_progress";
            publishProgress(copyId, event.issuerUserId(), processed, total, failed, status);
        }
        job.setSucceededItems(succeeded);
        job.setFailedItems(failed);
        job.setStatus(failed > 0 || skipped > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED");
        job.setCompletedAt(Instant.now());
        jobRepository.save(job);
        if (total == 0) {
            publishProgress(copyId, event.issuerUserId(), 0, 0, 0, "completed");
        }
    }

    private UncontrolledCopyService.DeliveryOutcome sendWithRetry(UUID copyId, String recipientEmail, UUID issuerUserId) {
        for (int attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt++) {
            try {
                UncontrolledCopyService.DeliveryOutcome outcome = uncontrolledCopyService.sendDistributionEmail(copyId, recipientEmail, issuerUserId);
                if (outcome != UncontrolledCopyService.DeliveryOutcome.FAILED) {
                    return outcome;
                }
                log.warn("Uncontrolled copy {} e-mail to {} was not delivered on attempt {}/{}", copyId, recipientEmail, attempt, MAX_PROCESSING_ATTEMPTS);
            } catch (Exception ex) {
                log.warn("Failed to send uncontrolled copy {} e-mail on attempt {}/{}: {}", copyId, attempt, MAX_PROCESSING_ATTEMPTS, ex.getMessage(), ex);
            }
            if (attempt < MAX_PROCESSING_ATTEMPTS) {
                try {
                    Thread.sleep(250L * attempt);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    return UncontrolledCopyService.DeliveryOutcome.FAILED;
                }
            }
        }
        return UncontrolledCopyService.DeliveryOutcome.FAILED;
    }

    private void recordFailure(UncontrolledCopyDistributedEvent event, String recipientEmail, String message) {
        try {
            uncontrolledCopyService.recordDistributionEmailFailure(event.uncontrolledCopyId(), event.issuerUserId(), recipientEmail, message);
        } catch (Exception ex) {
            log.error("Failed to audit uncontrolled copy {} distribution e-mail failure: {}", event.uncontrolledCopyId(), ex.getMessage(), ex);
        }
    }

    private void publishProgress(String copyId, UUID issuerUserId, int processed, int total, int failed, String status) {
        if (issuerUserId == null) {
            return;
        }
        // Same payload shape as the Controlled Copy progress event (the "batchId" slot carries the copy id),
        // so the frontend can reuse its existing SSE progress handling.
        notificationRealtimeService.publishUserEvent(
                issuerUserId,
                EVENT_NAME,
                new ControlledCopyBatchProgressEventResponse(EVENT_NAME, Instant.now().toString(), copyId, processed, total, failed, status)
        );
    }

    /** Restarts queued work after a backend restart; item state remains in the database. */
    @Scheduled(fixedDelay = 30000)
    public void resumePendingJobs() {
        for (UncontrolledCopyDistributionJob job : jobRepository.findTop10ByStatusOrderByCreatedAtAsc("PENDING")) {
            if (!"DISTRIBUTE".equals(job.getActionType())) {
                continue;
            }
            // Only reclaim jobs whose AFTER_COMMIT listener evidently never ran (older than one minute),
            // so a job that is merely queued on the executor is not processed twice.
            if (job.getCreatedAt() != null && job.getCreatedAt().isAfter(Instant.now().minusSeconds(60))) {
                continue;
            }
            Integer claimed = transactionTemplate.execute(status -> jobRepository.claimPendingJob(job.getId()));
            if (claimed == null || claimed != 1) {
                continue;
            }
            UUID copyId = transactionTemplate.execute(status -> {
                UncontrolledCopyDistributionJob fresh = jobRepository.findById(job.getId()).orElse(null);
                UncontrolledCopyRecord copy = fresh == null ? null : fresh.getUncontrolledCopy();
                return copy == null ? null : copy.getId();
            });
            UUID requestedBy = transactionTemplate.execute(status -> {
                UncontrolledCopyDistributionJob fresh = jobRepository.findById(job.getId()).orElse(null);
                return fresh == null || fresh.getRequestedBy() == null ? null : fresh.getRequestedBy().getId();
            });
            try {
                processJob(new UncontrolledCopyDistributedEvent(copyId, job.getId(), requestedBy));
            } catch (Exception ex) {
                log.warn("Failed to resume uncontrolled copy distribution job {}: {}", job.getId(), ex.getMessage(), ex);
            }
        }
    }

    /** Moves Distributed copies whose validity window has ended to Expired (one copy, one transaction). */
    @Scheduled(fixedDelay = 900000, initialDelay = 120000)
    public void expireDistributedCopies() {
        try (var lease = schedulerLockService.tryAcquire("uncontrolled-copy-expiry", Duration.ofMinutes(10))) {
            if (!lease.acquired()) {
                log.debug("Skipping uncontrolled-copy expiry run because another instance owns the lease or Redis is unavailable");
                return;
            }
            List<UUID> dueIds = transactionTemplate.execute(status -> uncontrolledCopyRepository
                    .findTop200ByStatusCodeAndValidUntilBeforeOrderByValidUntilAsc(UncontrolledCopyService.STATUS_DISTRIBUTED, Instant.now())
                    .stream().map(UncontrolledCopyRecord::getId).toList());
            if (dueIds == null) {
                return;
            }
            for (UUID id : dueIds) {
                try {
                    uncontrolledCopyService.expireCopy(id);
                } catch (Exception ex) {
                    log.warn("Failed to expire uncontrolled copy {}: {}", id, ex.getMessage(), ex);
                }
            }
        }
    }
}
