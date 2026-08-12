package com.eqms.service;

import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Keeps a distribution batch status consistent with the statuses of its member copies. */
@Service
public class ControlledCopyBatchStatusService {

    private static final String READY_FOR_DISTRIBUTION = "READY_FOR_DISTRIBUTION";
    private static final String DISTRIBUTED = "DISTRIBUTED";
    private static final String OBSOLETED = "OBSOLETED";
    private static final String CLOSED_CANCELLED = "CLOSED_CANCELLED";

    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyDistributionBatchRepository batchRepository;

    public ControlledCopyBatchStatusService(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository batchRepository
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.batchRepository = batchRepository;
    }

    public void synchronize(ControlledCopyRecord copy) {
        if (copy != null && copy.getDistributionBatch() != null) {
            synchronize(copy.getDistributionBatch());
        }
    }

    public void synchronize(Collection<ControlledCopyRecord> copies) {
        if (copies == null || copies.isEmpty()) return;
        Set<UUID> batchIds = new LinkedHashSet<>();
        for (ControlledCopyRecord copy : copies) {
            if (copy != null && copy.getDistributionBatch() != null && copy.getDistributionBatch().getId() != null) {
                batchIds.add(copy.getDistributionBatch().getId());
            }
        }
        batchIds.forEach(this::synchronize);
    }

    public void synchronizeBatches(Collection<ControlledCopyDistributionBatch> batches) {
        if (batches == null || batches.isEmpty()) return;
        batches.stream()
                .map(ControlledCopyDistributionBatch::getId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .forEach(this::synchronize);
    }

    public void synchronize(ControlledCopyDistributionBatch batch) {
        if (batch != null && batch.getId() != null) synchronize(batch.getId());
    }

    public void synchronize(UUID batchId) {
        if (batchId == null) return;
        ControlledCopyDistributionBatch batch = batchRepository.findById(batchId).orElse(null);
        if (batch == null) return;
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batchId);
        if (copies.isEmpty()) return;

        String nextStatus = deriveExpectedStatus(copies, batch.getStatusCode());
        if (nextStatus == null || nextStatus.isBlank()) return;

        batch.setStatusCode(nextStatus);
        batch.setStatus(labelFor(nextStatus));
        if (OBSOLETED.equals(nextStatus)) {
            ControlledCopyRecord latestObsoletedCopy = null;
            Instant latestRecallDate = null;
            for (ControlledCopyRecord copy : copies) {
                if (!OBSOLETED.equals(statusOf(copy))) continue;
                Instant copyRecallDate = copy.getRecalledAt() != null ? copy.getRecalledAt() : copy.getObsoletedAt();
                if (copyRecallDate != null && (latestRecallDate == null || copyRecallDate.isAfter(latestRecallDate))) {
                    latestRecallDate = copyRecallDate;
                    latestObsoletedCopy = copy;
                }
            }
            if (latestRecallDate != null) batch.setRecallDate(latestRecallDate);
            if (latestObsoletedCopy != null && latestObsoletedCopy.getRecallReason() != null
                    && !latestObsoletedCopy.getRecallReason().isBlank()) {
                batch.setRecallReason(latestObsoletedCopy.getRecallReason());
            }
        }
        batchRepository.save(batch);
    }

    /** Read-only: what status the batch's row should carry right now, without persisting
     *  anything. Used by the discrepancy scanner, which must never silently correct data. */
    public String peekExpectedStatus(ControlledCopyDistributionBatch batch, List<ControlledCopyRecord> copies) {
        if (batch == null || copies == null || copies.isEmpty()) return null;
        return deriveExpectedStatus(copies, batch.getStatusCode());
    }

    /** Pure, read-only computation of the status a batch's row should carry given its member
     *  copies. Shared by {@link #synchronize(UUID)} (which persists the result) and the
     *  discrepancy scanner (which only compares, never writes). */
    String deriveExpectedStatus(List<ControlledCopyRecord> copies, String currentStatusCode) {
        boolean allCancelled = copies.stream().allMatch(copy -> CLOSED_CANCELLED.equals(statusOf(copy)));
        // Closed-Cancelled is terminal and intentionally remains unchanged when the source
        // revision is obsoleted. It must not prevent the enclosing batch from becoming
        // Obsoleted once every still-active copy has been obsoleted.
        boolean hasNonCancelledCopy = copies.stream().anyMatch(copy -> !CLOSED_CANCELLED.equals(statusOf(copy)));
        boolean allNonCancelledCopiesObsoleted = copies.stream()
                .filter(copy -> !CLOSED_CANCELLED.equals(statusOf(copy)))
                .allMatch(copy -> OBSOLETED.equals(statusOf(copy)));
        boolean anyDistributed = copies.stream().anyMatch(copy -> DISTRIBUTED.equals(statusOf(copy)));
        boolean anyReady = copies.stream().anyMatch(copy -> READY_FOR_DISTRIBUTION.equals(statusOf(copy)));

        return allCancelled ? CLOSED_CANCELLED
                : hasNonCancelledCopy && allNonCancelledCopiesObsoleted ? OBSOLETED
                : anyDistributed ? DISTRIBUTED
                : anyReady ? READY_FOR_DISTRIBUTION
                : normalize(currentStatusCode);
    }

    private String statusOf(ControlledCopyRecord copy) {
        String code = normalize(copy.getStatusCode());
        return code == null || code.isBlank() ? normalize(copy.getCurrentStage()) : code;
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }

    private String labelFor(String status) {
        return switch (status) {
            case READY_FOR_DISTRIBUTION -> "Ready for Distribution";
            case DISTRIBUTED -> "Distributed";
            case OBSOLETED -> "Obsoleted";
            case CLOSED_CANCELLED -> "Closed - Cancelled";
            default -> status;
        };
    }
}
