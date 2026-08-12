package com.eqms;

import com.eqms.entity.ControlledCopyBatchStatusDiscrepancy;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.ControlledCopyBatchStatusDiscrepancyRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.service.ControlledCopyBatchDiscrepancyScanner;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the item-6 "batch vs child copy status drift" scanner: it must detect a real mismatch
 * (recording it for manual review) and must clear the alert once the mismatch stops reproducing,
 * without ever rewriting the batch/copy rows itself.
 */
@SpringBootTest
@TestPropertySource(properties = "app.scheduler-lock.redis.enabled=false")
@Transactional
public class ControlledCopyBatchDiscrepancyScannerIntegrationTest {

    @Autowired
    private ControlledCopyBatchDiscrepancyScanner scanner;

    @Autowired
    private ControlledCopyDistributionBatchRepository batchRepository;

    @Autowired
    private ControlledCopyRepository controlledCopyRepository;

    @Autowired
    private ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepository;

    @Test
    void scan_detectsAndThenClearsAGenuineBatchCopyMismatch() {
        ControlledCopyDistributionBatch batch = batchRepository.findAll().stream()
                .filter(candidate -> !"OBSOLETED".equals(normalize(candidate.getStatusCode())))
                .filter(candidate -> !"CLOSED_CANCELLED".equals(normalize(candidate.getStatusCode())))
                .filter(candidate -> !controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(candidate.getId()).isEmpty())
                .findFirst()
                .orElseThrow(() -> new AssertionError("Seed data must contain a non-terminal batch with at least one copy"));

        String originalBatchStatus = normalize(batch.getStatusCode());
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batch.getId());

        // Force every member copy to Obsoleted directly (bypassing the service, the way an
        // interrupted/partial write in production could) while leaving the batch row itself at
        // its original (non-Obsoleted) status. Derived status for the batch should now be
        // Obsoleted, which disagrees with the stored row -- a genuine drift.
        List<String> originalCopyStatusCodes = copies.stream().map(ControlledCopyRecord::getStatusCode).toList();
        List<String> originalCopyStatusLabels = copies.stream().map(ControlledCopyRecord::getStatus).toList();
        for (ControlledCopyRecord copy : copies) {
            copy.setStatusCode("OBSOLETED");
            copy.setStatus("Obsoleted");
            controlledCopyRepository.save(copy);
        }

        scanner.scanForDiscrepancies();

        Optional<ControlledCopyBatchStatusDiscrepancy> open = discrepancyRepository.findByBatch_IdAndStatus(
                batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
        assertTrue(open.isPresent(), "Scanner must record an open discrepancy for a batch whose row disagrees with its copies");
        assertEquals("OBSOLETED", open.get().getExpectedStatusCode());
        assertEquals(originalBatchStatus, open.get().getActualStatusCode());

        ControlledCopyDistributionBatch reloaded = batchRepository.findById(batch.getId()).orElseThrow();
        assertEquals(originalBatchStatus, normalize(reloaded.getStatusCode()),
                "Scanner must never rewrite the batch status itself -- only flag it for review");

        // Now bring the copies back to their original statuses and confirm the alert clears.
        for (int i = 0; i < copies.size(); i++) {
            copies.get(i).setStatusCode(originalCopyStatusCodes.get(i));
            copies.get(i).setStatus(originalCopyStatusLabels.get(i));
            controlledCopyRepository.save(copies.get(i));
        }
        scanner.scanForDiscrepancies();

        Optional<ControlledCopyBatchStatusDiscrepancy> stillOpen = discrepancyRepository.findByBatch_IdAndStatus(
                batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
        assertTrue(stillOpen.isEmpty(), "Discrepancy must clear once the batch and its copies agree again");
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
