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
import static org.junit.jupiter.api.Assertions.assertNotNull;
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

    @Autowired
    private com.eqms.service.ControlledCopyBatchStatusService batchStatusService;

    @Test
    void scan_detectsAndThenClearsAGenuineBatchCopyMismatch() {
        ControlledCopyDistributionBatch batch = batchRepository.findAll().stream()
                .filter(candidate -> !"OBSOLETED".equals(normalize(candidate.getStatusCode())))
                .filter(candidate -> !"CLOSED_CANCELLED".equals(normalize(candidate.getStatusCode())))
                .filter(candidate -> !controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(candidate.getId()).isEmpty())
                .findFirst()
                .orElseThrow(() -> new AssertionError("Seed data must contain a non-terminal batch with at least one copy"));

        String originalBatchStatus = normalize(batch.getStatusCode());
        String originalBatchLabel = batch.getStatus();
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batch.getId());
        String expected = batchStatusService.peekExpectedStatus(batch, copies);
        assertNotNull(expected, "the batch must have a status that its copies imply");

        // Put the batch row itself at a status its copies do not imply (the way an interrupted write could), and leave the copies as they are: a genuine drift. The copies are
        // not touched, because a copy never goes back from a status it has left (the server refuses to save it, STATUS-CONSISTENCY-2026-11-14).
        String wrong = "DISTRIBUTED".equals(expected) ? "READY_FOR_DISTRIBUTION" : "DISTRIBUTED";
        batch.setStatusCode(wrong);
        batch.setStatus("DISTRIBUTED".equals(wrong) ? "Distributed" : "Ready for Distribution");
        batchRepository.saveAndFlush(batch);

        scanner.scanForDiscrepancies();

        Optional<ControlledCopyBatchStatusDiscrepancy> open = discrepancyRepository.findByBatch_IdAndStatus(
                batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
        assertTrue(open.isPresent(), "Scanner must record an open discrepancy for a batch whose row disagrees with its copies");
        assertEquals(expected, open.get().getExpectedStatusCode());
        assertEquals(wrong, open.get().getActualStatusCode());

        ControlledCopyDistributionBatch reloaded = batchRepository.findById(batch.getId()).orElseThrow();
        assertEquals(wrong, normalize(reloaded.getStatusCode()),
                "Scanner must never rewrite the batch status itself -- only flag it for review");

        // Now bring the batch back to what it was and confirm the alert clears.
        reloaded.setStatusCode(originalBatchStatus);
        reloaded.setStatus(originalBatchLabel);
        batchRepository.saveAndFlush(reloaded);
        scanner.scanForDiscrepancies();

        Optional<ControlledCopyBatchStatusDiscrepancy> stillOpen = discrepancyRepository.findByBatch_IdAndStatus(
                batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
        assertTrue(stillOpen.isEmpty() || !originalBatchStatus.equals(expected), "Discrepancy must clear once the batch and its copies agree again");
    }

    /**
     * Found on the review screen: two discrepancies stayed OPEN for weeks although their batches had since been corrected (the
     * normal flow moved them to a terminal status). The scan only visits active batches, so it never saw them again and never
     * cleared the alert. A flagged batch must be re-checked even after it became terminal.
     */
    @Test
    void scan_clearsAnOpenDiscrepancyOfABatchThatBecameTerminalAndNowAgreesWithItsCopies() {
        ControlledCopyDistributionBatch batch = batchRepository.findAll().stream()
                .filter(candidate -> List.of("OBSOLETED", "CLOSED_CANCELLED").contains(normalize(candidate.getStatusCode())))
                .filter(candidate -> {
                    var copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(candidate.getId());
                    return !copies.isEmpty() && normalize(candidate.getStatusCode()).equals(batchStatusService.peekExpectedStatus(candidate, copies));
                })
                .findFirst()
                .orElseThrow(() -> new AssertionError("Seed data must contain a terminal batch that agrees with its copies"));
        discrepancyRepository.findByBatch_IdAndStatus(batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN)
                .ifPresent(existing -> {
                    existing.setStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_RESOLVED);
                    discrepancyRepository.saveAndFlush(existing);
                });
        // The alert as it was raised back then, while the batch was still wrong.
        ControlledCopyBatchStatusDiscrepancy stale = new ControlledCopyBatchStatusDiscrepancy();
        stale.setBatch(batch);
        stale.setBatchNumber(batch.getBatchNumber());
        stale.setExpectedStatusCode(normalize(batch.getStatusCode()));
        stale.setActualStatusCode("DISTRIBUTED");
        stale.setStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
        stale.setDetectedAt(java.time.Instant.now().minusSeconds(86400));
        stale.setLastCheckedAt(java.time.Instant.now().minusSeconds(86400));
        discrepancyRepository.saveAndFlush(stale);

        scanner.scanForDiscrepancies();

        assertTrue(discrepancyRepository.findByBatch_IdAndStatus(batch.getId(), ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN).isEmpty(),
                "An alert for a batch that is terminal and consistent again must be cleared");
        assertEquals(ControlledCopyBatchStatusDiscrepancy.STATUS_RESOLVED,
                discrepancyRepository.findById(stale.getId()).orElseThrow().getStatus());
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
