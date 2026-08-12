package com.eqms.service;

import com.eqms.dto.notification.ControlledCopyBatchProgressEventResponse;
import com.eqms.entity.ControlledCopyDistributionJob;
import com.eqms.entity.ControlledCopyDistributionJobItem;
import com.eqms.repository.ControlledCopyDistributionJobItemRepository;
import com.eqms.repository.ControlledCopyDistributionJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Runs the per-copy part of Recall Batch (status flip + individual audit log) in the background
 * after the batch-level status/audit transaction commits, so one bad copy never blocks the rest
 * of the batch and a large batch never blocks the HTTP response. Mirrors
 * {@link ControlledCopyBatchDistributionAsyncService}, kept as a separate class because Recall
 * carries its own reason/date parameters and has no "roll back to prior state" step on failure
 * (a failed recall attempt simply leaves the copy untouched — nothing to undo).
 */
@Service
public class ControlledCopyBatchRecallAsyncService {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyBatchRecallAsyncService.class);
    private static final String EVENT_NAME = "controlled-copy-batch-progress";
    private static final int MAX_PROCESSING_ATTEMPTS = 3;

    private final ControlledCopyService controlledCopyService;
    private final NotificationRealtimeService notificationRealtimeService;
    private final ControlledCopyDistributionJobRepository jobRepository;
    private final ControlledCopyDistributionJobItemRepository itemRepository;

    public ControlledCopyBatchRecallAsyncService(
            ControlledCopyService controlledCopyService,
            NotificationRealtimeService notificationRealtimeService,
            ControlledCopyDistributionJobRepository jobRepository,
            ControlledCopyDistributionJobItemRepository itemRepository
    ) {
        this.controlledCopyService = controlledCopyService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.jobRepository = jobRepository;
        this.itemRepository = itemRepository;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBatchRecalled(ControlledCopyBatchRecalledEvent event) {
        List<ControlledCopyDistributionJobItem> items = event.jobId() == null ? List.of() : itemRepository.findAllByJob_IdOrderByIdAsc(event.jobId());
        List<UUID> copyIds = items.isEmpty() ? (event.copyIds() == null ? List.of() : event.copyIds()) : items.stream().map(item -> item.getControlledCopy().getId()).toList();
        ControlledCopyDistributionJob job = event.jobId() == null ? null : jobRepository.findById(event.jobId()).orElse(null);
        if (job != null) { job.setStatus("PROCESSING"); job.setStartedAt(Instant.now()); jobRepository.save(job); }
        int total = copyIds.size();
        String batchId = event.batchId() == null ? null : event.batchId().toString();
        int processed = 0;
        int failed = 0;
        publishProgress(batchId, event.issuerUserId(), processed, total, failed, "in_progress");
        for (int index = 0; index < copyIds.size(); index++) {
            UUID copyId = copyIds.get(index);
            ControlledCopyDistributionJobItem item = index < items.size() ? items.get(index) : null;
            if (item != null) { item.setStatus("PROCESSING"); item.setAttempts(item.getAttempts() + 1); item.setProcessingStartedAt(Instant.now()); itemRepository.save(item); }
            if (!finalizeWithRetry(copyId, event.issuerUserId(), event.recallReason(), event.recalledAt(), batchId)) {
                failed++;
                if (item != null) { item.setStatus("FAILED"); item.setLastErrorCode("RECALL_PROCESSING_FAILED"); item.setLastErrorMessage("Recall failed after automatic retries."); item.setCompletedAt(Instant.now()); itemRepository.save(item); }
            } else if (item != null) {
                item.setStatus("SUCCESS"); item.setCompletedAt(Instant.now()); itemRepository.save(item);
            }
            processed++;
            String status = processed == total ? (failed > 0 ? "completed_with_errors" : "completed") : "in_progress";
            publishProgress(batchId, event.issuerUserId(), processed, total, failed, status);
        }
        if (job != null) { job.setSucceededItems(total - failed); job.setFailedItems(failed); job.setStatus(failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED"); job.setCompletedAt(Instant.now()); jobRepository.save(job); }
    }

    /**
     * Re-runs only the FAILED items of the most recent recall job for a batch. A no-op if there
     * is no job or no failed items, so it is safe to call speculatively.
     */
    @Async
    public void retryFailedItems(UUID batchId, UUID issuerUserId, String recallReason, Instant recalledAt) {
        if (batchId == null) {
            return;
        }
        ControlledCopyDistributionJob job = jobRepository.findByBatch_IdAndActionTypeOrderByCreatedAtDesc(batchId, "RECALL").stream().findFirst().orElse(null);
        if (job == null) {
            return;
        }
        List<ControlledCopyDistributionJobItem> failedItems = itemRepository.findAllByJob_IdAndStatusOrderByIdAsc(job.getId(), "FAILED");
        if (failedItems.isEmpty()) {
            return;
        }
        String batchIdText = batchId.toString();
        job.setStatus("PROCESSING");
        jobRepository.save(job);
        int total = failedItems.size();
        int processed = 0;
        int failed = 0;
        publishProgress(batchIdText, issuerUserId, processed, total, failed, "in_progress");
        for (ControlledCopyDistributionJobItem item : failedItems) {
            UUID copyId = item.getControlledCopy().getId();
            item.setStatus("PROCESSING");
            item.setAttempts(item.getAttempts() + 1);
            item.setProcessingStartedAt(Instant.now());
            itemRepository.save(item);
            boolean success = finalizeWithRetry(copyId, issuerUserId, recallReason, recalledAt, batchIdText);
            if (!success) {
                failed++;
                item.setStatus("FAILED");
                item.setLastErrorCode("RECALL_PROCESSING_FAILED");
                item.setLastErrorMessage("Recall failed again after retry.");
            } else {
                item.setStatus("SUCCESS");
            }
            item.setCompletedAt(Instant.now());
            itemRepository.save(item);
            processed++;
            String status = processed == total ? (failed > 0 ? "completed_with_errors" : "completed") : "in_progress";
            publishProgress(batchIdText, issuerUserId, processed, total, failed, status);
        }
        List<ControlledCopyDistributionJobItem> allItems = itemRepository.findAllByJob_IdOrderByIdAsc(job.getId());
        int succeededCount = (int) allItems.stream().filter(i -> "SUCCESS".equals(i.getStatus())).count();
        int failedCount = (int) allItems.stream().filter(i -> "FAILED".equals(i.getStatus())).count();
        job.setSucceededItems(succeededCount);
        job.setFailedItems(failedCount);
        job.setStatus(failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED");
        job.setCompletedAt(Instant.now());
        jobRepository.save(job);
    }

    private boolean finalizeWithRetry(UUID copyId, UUID issuerUserId, String recallReason, Instant recalledAt, String batchId) {
        for (int attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt++) {
            try {
                if (controlledCopyService.finalizeRecalledCopy(copyId, issuerUserId, recallReason, recalledAt)) {
                    return true;
                }
                log.warn("Controlled copy {} in recall batch {} was not processed on attempt {}/{}", copyId, batchId, attempt, MAX_PROCESSING_ATTEMPTS);
            } catch (Exception ex) {
                log.warn("Failed to recall controlled copy {} in batch {} on attempt {}/{}: {}", copyId, batchId, attempt, MAX_PROCESSING_ATTEMPTS, ex.getMessage(), ex);
            }
            if (attempt < MAX_PROCESSING_ATTEMPTS) {
                try {
                    Thread.sleep(250L * attempt);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
        }
        return false;
    }

    private void publishProgress(String batchId, UUID issuerUserId, int processed, int total, int failed, String status) {
        if (issuerUserId == null) {
            return;
        }
        notificationRealtimeService.publishUserEvent(
                issuerUserId,
                EVENT_NAME,
                new ControlledCopyBatchProgressEventResponse(EVENT_NAME, Instant.now().toString(), batchId, processed, total, failed, status)
        );
    }

    /** Restarts queued work after a backend restart; item state remains in the database. */
    @Scheduled(fixedDelay = 30000)
    public void resumePendingJobs() {
        for (ControlledCopyDistributionJob job : jobRepository.findTop10ByStatusOrderByCreatedAtAsc("PENDING")) {
            if (!"RECALL".equals(job.getActionType())) {
                continue;
            }
            if (jobRepository.claimPendingJob(job.getId()) != 1) {
                continue;
            }
            List<UUID> copyIds = itemRepository.findAllByJob_IdOrderByIdAsc(job.getId()).stream()
                    .filter(item -> "PENDING".equals(item.getStatus()))
                    .map(item -> item.getControlledCopy().getId()).toList();
            if (!copyIds.isEmpty()) {
                onBatchRecalled(new ControlledCopyBatchRecalledEvent(
                        job.getBatch().getId(), job.getId(), copyIds, job.getRequestedBy().getId(),
                        job.getBatch().getRecallReason(), job.getBatch().getRecallDate()
                ));
            }
        }
    }
}
