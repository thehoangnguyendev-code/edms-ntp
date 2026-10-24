package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.DocumentRecord;
import com.eqms.repository.DocumentRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Runs every 15 minutes (owner decision DOCUMENT-EXPIRY-2026-10-16: notify at the moment of expiry).
 * Processes each newly expired Active document once, then retries any notification that failed.
 * Guarded by the distributed scheduler lock so only one instance runs it at a time.
 */
@Service
public class DocumentExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(DocumentExpiryScheduler.class);
    private static final String LOCK_NAME = "document-expiry";
    private static final ZoneId SYSTEM_ZONE = DateTimeFormatUtils.ZONE;

    private final DistributedSchedulerLockService schedulerLockService;
    private final DocumentExpiryProcessingService processingService;
    private final DocumentExpiryNotifier notifier;
    private final DocumentRecordRepository documentRepository;

    public DocumentExpiryScheduler(
            DistributedSchedulerLockService schedulerLockService,
            DocumentExpiryProcessingService processingService,
            DocumentExpiryNotifier notifier,
            DocumentRecordRepository documentRepository
    ) {
        this.schedulerLockService = schedulerLockService;
        this.processingService = processingService;
        this.notifier = notifier;
        this.documentRepository = documentRepository;
    }

    @Scheduled(fixedDelayString = "PT15M", initialDelayString = "PT1M")
    public void runExpiryProcessing() {
        try (var lease = schedulerLockService.tryAcquire(LOCK_NAME, Duration.ofMinutes(14))) {
            if (!lease.acquired()) {
                log.debug("Skipping document expiry run: another instance owns the lease or Redis is unavailable");
                return;
            }
            processDueDocuments();
            retryPendingNotifications();
        } catch (Exception ex) {
            log.error("Document expiry run failed", ex);
        }
    }

    void processDueDocuments() {
        Instant now = Instant.now();
        LocalDate today = LocalDate.now(SYSTEM_ZONE);
        for (UUID documentId : processingService.findDueDocumentIds(today)) {
            try {
                processingService.processDocument(documentId, now).ifPresent(outcome -> {
                    try {
                        notifier.notifyExpired(outcome.documentId(), outcome.documentNumber(), outcome.documentName(), now);
                    } catch (Exception ex) {
                        log.warn("Expiry notification for document {} failed; it will be retried: {}", documentId, ex.getMessage(), ex);
                    }
                });
            } catch (Exception ex) {
                // The whole document is rolled back (including its processing marker), so it is retried next run.
                log.warn("Expiry processing for document {} failed and will be retried: {}", documentId, ex.getMessage(), ex);
            }
        }
    }

    void retryPendingNotifications() {
        Instant now = Instant.now();
        for (UUID documentId : processingService.findPendingNotificationDocumentIds()) {
            DocumentRecord document = documentRepository.findById(documentId).orElse(null);
            if (document == null) {
                continue;
            }
            try {
                notifier.notifyExpired(documentId, document.getDocumentNumber(), document.getDocumentName(), now);
            } catch (Exception ex) {
                log.warn("Retry of expiry notification for document {} failed: {}", documentId, ex.getMessage(), ex);
            }
        }
    }
}
