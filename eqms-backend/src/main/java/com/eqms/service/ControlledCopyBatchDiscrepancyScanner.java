package com.eqms.service;

import com.eqms.entity.ControlledCopyBatchStatusDiscrepancy;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.ControlledCopyBatchStatusDiscrepancyRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.Duration;
import java.util.List;

/**
 * Periodically compares each active distribution batch's stored status against the status
 * derived from its member copies (via {@link ControlledCopyBatchStatusService#peekExpectedStatus}),
 * and records a discrepancy for manual review when they differ.
 *
 * This scanner is intentionally read-only with respect to batch/copy data: it never rewrites a
 * mismatched status itself. Auto-correcting silently would risk masking a real defect (a stuck
 * job, a partially-applied concurrent update) behind a status that merely looks consistent again.
 * Reviewers see open discrepancies on the "Cần kiểm tra" screen instead.
 */
@Service
public class ControlledCopyBatchDiscrepancyScanner {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyBatchDiscrepancyScanner.class);
    private static final List<String> TERMINAL_STATUSES = List.of("CLOSED_CANCELLED", "OBSOLETED");
    private static final int BATCH_PAGE_SIZE = 100;

    private final ControlledCopyDistributionBatchRepository batchRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepository;
    private final ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    private final DistributedSchedulerLockService schedulerLockService;

    public ControlledCopyBatchDiscrepancyScanner(
            ControlledCopyDistributionBatchRepository batchRepository,
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepository,
            ControlledCopyBatchStatusService controlledCopyBatchStatusService,
            DistributedSchedulerLockService schedulerLockService
    ) {
        this.batchRepository = batchRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.discrepancyRepository = discrepancyRepository;
        this.controlledCopyBatchStatusService = controlledCopyBatchStatusService;
        this.schedulerLockService = schedulerLockService;
    }

    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void scanForDiscrepancies() {
        try (var lease = schedulerLockService.tryAcquire("controlled-copy-batch-discrepancy", Duration.ofMinutes(15))) {
            if (!lease.acquired()) {
                log.debug("Skipping controlled-copy discrepancy scan because another instance owns the lease or Redis is unavailable");
                return;
            }
            Instant now = Instant.now();
            int found = 0;
            long scanned = 0;
            int pageNumber = 0;
            Page<ControlledCopyDistributionBatch> activeBatches;
            do {
                activeBatches = batchRepository.findAllByStatusCodeNotIn(
                        TERMINAL_STATUSES,
                        PageRequest.of(pageNumber++, BATCH_PAGE_SIZE)
                );
                for (ControlledCopyDistributionBatch batch : activeBatches.getContent()) {
                    found += scanBatch(batch, now) ? 1 : 0;
                    scanned++;
                }
            } while (activeBatches.hasNext());
            if (scanned == 0) {
                return;
            }
            if (found > 0) {
                log.warn("Controlled copy batch/copy status discrepancy scan found {} new or ongoing mismatch(es) out of {} active batches",
                        found, scanned);
            }
        }
    }

    private boolean scanBatch(ControlledCopyDistributionBatch batch, Instant now) {
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batch.getId());
        String expected = controlledCopyBatchStatusService.peekExpectedStatus(batch, copies);
        String actual = normalize(batch.getStatusCode());

        var existingOpen = discrepancyRepository.findByBatch_IdAndStatus(batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);

        if (expected == null || expected.isBlank() || expected.equals(actual)) {
            existingOpen.ifPresent(discrepancy -> {
                discrepancy.setStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_RESOLVED);
                discrepancy.setResolvedAt(now);
                discrepancy.setLastCheckedAt(now);
                discrepancyRepository.save(discrepancy);
            });
            return false;
        }

        if (existingOpen.isPresent()) {
            ControlledCopyBatchStatusDiscrepancy discrepancy = existingOpen.get();
            discrepancy.setActualStatusCode(actual);
            discrepancy.setExpectedStatusCode(expected);
            discrepancy.setLastCheckedAt(now);
            discrepancyRepository.save(discrepancy);
        } else {
            ControlledCopyBatchStatusDiscrepancy discrepancy = new ControlledCopyBatchStatusDiscrepancy();
            discrepancy.setBatch(batch);
            discrepancy.setBatchNumber(batch.getBatchNumber());
            discrepancy.setExpectedStatusCode(expected);
            discrepancy.setActualStatusCode(actual);
            discrepancy.setStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
            discrepancy.setDetectedAt(now);
            discrepancy.setLastCheckedAt(now);
            discrepancyRepository.save(discrepancy);
        }
        return true;
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
