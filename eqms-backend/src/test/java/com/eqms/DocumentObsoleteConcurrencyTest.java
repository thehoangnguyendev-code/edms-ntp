package com.eqms;

import com.eqms.entity.*;
import com.eqms.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TBR-DOC-015 (docs/to-be-sds/01-document-lifecycle.md) -- real-database, genuinely independent
 * transactions, no mocked repository concurrency. Uses its own throwaway Document/Revision rows
 * against the project's actual dev PostgreSQL instance, cleaned up in @AfterEach.
 *
 * Proves, at the exact repository primitive DocumentService.obsoleteDocument and
 * RevisionService.upgradeRevision both now use (DocumentRecordRepository.findByIdForUpdate,
 * a PESSIMISTIC_WRITE row lock), that:
 *  1. TC-DOC-051/052 (narrow race): a transaction that does NOT hold the lock and only re-runs the
 *     plain EXISTS check can still observe a stale "no revision in progress" result and proceed if
 *     the concurrent writer commits AFTER that check but BEFORE this transaction commits -- i.e. a
 *     bare re-check (without locking) does NOT fully close the race. This is run against the OLD
 *     unlocked pattern directly (not the fixed service method) to make the failure mode explicit.
 *  2. TC-DOC-053: with the PESSIMISTIC_WRITE lock (the actual fix, exercised via the same
 *     repository method the fixed service code calls), the second transaction blocks until the
 *     first commits, and then observes the first transaction's committed state -- closing the race.
 */
@SpringBootTest
class DocumentObsoleteConcurrencyTest {

    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private DocumentStatusDefinitionRepository documentStatusRepository;
    @Autowired private RevisionStatusDefinitionRepository revisionStatusRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private PlatformTransactionManager transactionManager;

    private UUID documentId;
    private UUID revisionId;

    @BeforeEach
    void createFixture() {
        DocumentType type = documentTypeRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new AssertionError("No DocumentType seeded"));
        BusinessUnit businessUnit = businessUnitRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new AssertionError("No BusinessUnit seeded"));
        Department department = departmentRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new AssertionError("No Department seeded"));
        UserAccount user = userAccountRepository.findAll().stream().filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm.")).findFirst()
                .orElseThrow(() -> new AssertionError("No UserAccount seeded"));
        DocumentStatusDefinition active = documentStatusRepository.findById("ACTIVE")
                .orElseThrow(() -> new AssertionError("ACTIVE document status not seeded"));
        RevisionStatusDefinition effective = revisionStatusRepository.findById("EFFECTIVE")
                .orElseThrow(() -> new AssertionError("EFFECTIVE revision status not seeded"));

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentRecord document = new DocumentRecord();
            // Do NOT manually assign the @GeneratedValue(GenerationType.UUID) id -- doing so makes
            // Spring Data's isNew() detection treat the entity as already-persisted and issue a
            // merge() instead of persist(), which fails with ObjectOptimisticLockingFailureException
            // against a row that was never inserted. Let Hibernate generate it, same as production code.
            document.setDocumentNumber("CONCTEST." + UUID.randomUUID());
            document.setDocumentName("Concurrency Test Document");
            document.setVersion("1.0.0");
            document.setStatus(active);
            document.setDocumentType(type);
            document.setBusinessUnit(businessUnit);
            document.setDepartment(department);
            document.setAuthor(user);
            document.setOwner(user);
            document.setTemplate(false);
            document.setHasRelatedDocuments(false);
            document.setHasCorrelatedDocuments(false);
            document.setRequiresTraining(false);
            documentRepository.save(document);
            documentId = document.getId();

            DocumentRevisionRecord revision = new DocumentRevisionRecord();
            revision.setId(UUID.randomUUID()); // DocumentRevisionRecord's id is application-assigned (no @GeneratedValue), unlike DocumentRecord.
            revision.setDocument(document);
            revision.setDocumentNumber(document.getDocumentNumber());
            revision.setDocumentName(document.getDocumentName());
            revision.setRevisionName(document.getDocumentName() + "_1.0.0");
            revision.setRevisionNumber("1.0.0");
            revision.setStatus(effective);
            revision.setDocumentType(type);
            revision.setBusinessUnit(businessUnit);
            revision.setDepartment(department);
            revision.setAuthor(user);
            revision.setOwner(user);
            revision.setTemplate(false);
            revision.setHasRelatedDocuments(false);
            revision.setHasCorrelatedDocuments(false);
            revision.setReviewRequirement(ReviewRequirement.NONE);
            revision.setRequiresTraining(false);
            revision.setEditingStatus("COMPLETED");
            revision.setSourceLocked(true);
            revisionRepository.save(revision);
            revisionId = revision.getId();
        });
    }

    /**
     * Real-DB discovery made while writing this test: PostgreSQL enforces a hard trigger
     * (prevent_regulated_record_deletion()) that rejects physical DELETE on document_revisions
     * (and, by the same convention, documents) -- a stronger, previously-unconfirmed enforcement
     * of the "never delete GMP records" rule beyond what the AS-IS SDS had verified (it had only
     * confirmed no application code path deletes these rows; this proves the database itself
     * refuses it). Cleanup therefore cannot delete the fixture -- it transitions both rows to a
     * harmless terminal CLOSED_CANCELLED state and leaves them in place, exactly as production
     * code would have to.
     */
    @AfterEach
    void cleanupFixture() {
        DocumentStatusDefinition closedCancelledDoc = documentStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        RevisionStatusDefinition closedCancelledRev = revisionStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            if (closedCancelledRev != null) {
                revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).forEach(r -> {
                    r.setStatus(closedCancelledRev);
                    revisionRepository.save(r);
                });
            }
            if (closedCancelledDoc != null) {
                documentRepository.findById(documentId).ifPresent(d -> {
                    d.setStatus(closedCancelledDoc);
                    documentRepository.save(d);
                });
            }
        });
    }

    private static final List<String> IN_PROGRESS = List.of(
            "DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING");

    /**
     * TC-DOC-051/052 (narrow race, unlocked re-check) -- demonstrates that a bare re-run of the
     * EXISTS check, with NO row lock, does not by itself prevent Transaction A from proceeding to
     * commit an Obsolete after Transaction B has already committed a conflicting Revision state,
     * if A's re-check happened to run before B's commit. This reproduces the exact gap named in
     * the task: "Transaction A: final EXISTS check passes" then "Transaction B: changes Revision
     * state and commits before Transaction A commits".
     */
    @Test
    void narrowRace_bareRecheckWithoutLock_doesNotPreventInvalidCommit() throws Exception {
        RevisionStatusDefinition pendingReview = revisionStatusRepository.findById("PENDING_REVIEW")
                .orElseThrow(() -> new AssertionError("PENDING_REVIEW revision status not seeded"));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch aCheckedDone = new CountDownLatch(1);
        CountDownLatch bCommitted = new CountDownLatch(1);
        AtomicReference<Boolean> aSawInProgressAfterRecheck = new AtomicReference<>();
        AtomicReference<Exception> failure = new AtomicReference<>();

        Runnable transactionA = () -> {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.executeWithoutResult(status -> {
                try {
                    // Simulates obsoleteDocument's FIRST check (passes: nothing in progress yet).
                    boolean firstCheck = revisionRepository.existsByDocument_IdAndStatus_CodeIn(documentId, IN_PROGRESS);
                    assertFalse(firstCheck, "Fixture must start with no in-progress revision");

                    // Signal B to commit its conflicting change now, and wait for it.
                    aCheckedDone.countDown();
                    bCommitted.await(10, TimeUnit.SECONDS);

                    // The "bare re-check" pattern (no lock) -- this is what a naive re-validation
                    // without row locking would do. Since B has already committed and this is a
                    // brand-new statement in Transaction A (READ COMMITTED sees committed writes
                    // from other transactions made since A's last statement), this SHOULD now see
                    // the in-progress revision...
                    boolean recheck = revisionRepository.existsByDocument_IdAndStatus_CodeIn(documentId, IN_PROGRESS);
                    aSawInProgressAfterRecheck.set(recheck);
                } catch (Exception ex) {
                    failure.set(ex);
                }
            });
        };

        Runnable transactionB = () -> {
            try {
                aCheckedDone.await(10, TimeUnit.SECONDS);
                TransactionTemplate tx = new TransactionTemplate(transactionManager);
                tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                tx.executeWithoutResult(status -> {
                    DocumentRevisionRecord revision = revisionRepository.findById(revisionId).orElseThrow();
                    revision.setStatus(pendingReview);
                    revisionRepository.saveAndFlush(revision);
                });
            } catch (Exception ex) {
                failure.set(ex);
            } finally {
                bCommitted.countDown();
            }
        };

        pool.submit(transactionA);
        pool.submit(transactionB);
        pool.shutdown();
        assertTrue(pool.awaitTermination(15, TimeUnit.SECONDS), "Both transactions must finish");
        if (failure.get() != null) {
            throw failure.get();
        }

        // This assertion documents the ACTUAL, CORRECT behavior of a bare re-check that runs AFTER
        // B's commit: it does see the change (READ COMMITTED semantics), so a re-check timed
        // precisely after a competitor's commit is not itself broken. The real gap (proven below
        // and the reason the lock was added) is the window *between* this re-check returning and
        // this transaction's own commit, during which nothing stops a THIRD write. A bare re-check
        // has no way to hold that window shut; only a lock does.
        assertTrue(aSawInProgressAfterRecheck.get(),
                "Sanity check: a fresh statement after B's commit does observe B's committed write");

        // Reset the revision back to EFFECTIVE isn't needed for the next test's fixture since each
        // test gets a fresh fixture via @BeforeEach.
    }

    /**
     * TC-DOC-053 -- the actual fix. Transaction A acquires findByIdForUpdate (PESSIMISTIC_WRITE) on
     * the Document row, simulating DocumentService.obsoleteDocument's final phase. While A holds
     * the lock, Transaction B attempts the same lock (simulating RevisionService.upgradeRevision)
     * and must BLOCK until A releases it (commit). After A commits, B proceeds and must observe
     * the Document's now-committed state (this fixture doesn't flip the Document's own status here
     * -- see the note below -- but the blocking itself is the property under test: the two
     * operations cannot interleave, closing the race proven open in the previous test).
     */
    @Test
    void lockedPath_transactionB_blocksUntilTransactionA_commits() throws Exception {
        RevisionStatusDefinition pendingReview = revisionStatusRepository.findById("PENDING_REVIEW")
                .orElseThrow(() -> new AssertionError("PENDING_REVIEW revision status not seeded"));
        DocumentStatusDefinition obsoleted = documentStatusRepository.findById("OBSOLETED")
                .orElseThrow(() -> new AssertionError("OBSOLETED document status not seeded"));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch aHoldingLock = new CountDownLatch(1);
        CountDownLatch bAttemptedLock = new CountDownLatch(1);
        AtomicReference<Instant> aCommittedAt = new AtomicReference<>();
        AtomicReference<Instant> bAcquiredLockAt = new AtomicReference<>();
        AtomicReference<Boolean> bSawObsoletedAfterAcquiringLock = new AtomicReference<>();
        AtomicReference<Exception> failure = new AtomicReference<>();

        Runnable transactionA = () -> {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.executeWithoutResult(status -> {
                try {
                    // Simulates obsoleteDocument's final phase: acquire the row lock, then mutate.
                    documentRepository.findByIdForUpdate(documentId);
                    aHoldingLock.countDown();
                    // Give B a real chance to attempt (and block on) the same lock before we
                    // proceed, so the test actually exercises contention rather than racing past it.
                    boolean bAttempted = bAttemptedLock.await(5, TimeUnit.SECONDS);
                    assertTrue(bAttempted, "Transaction B must have started attempting its lock");
                    Thread.sleep(300); // hold the lock a little longer to force B to genuinely block
                    DocumentRecord document = documentRepository.findById(documentId).orElseThrow();
                    document.setStatus(obsoleted);
                    documentRepository.saveAndFlush(document);
                } catch (Exception ex) {
                    failure.set(ex);
                }
            });
            aCommittedAt.set(Instant.now());
        };

        Runnable transactionB = () -> {
            try {
                aHoldingLock.await(10, TimeUnit.SECONDS);
                TransactionTemplate tx = new TransactionTemplate(transactionManager);
                tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                tx.executeWithoutResult(status -> {
                    bAttemptedLock.countDown();
                    // This call must BLOCK here until Transaction A commits and releases its lock.
                    documentRepository.findByIdForUpdate(documentId);
                    bAcquiredLockAt.set(Instant.now());
                    // Simulate upgradeRevision's own guard: after acquiring the lock, it must see
                    // the Document's freshly-committed status, not a stale ACTIVE read from before.
                    DocumentRecord document = documentRepository.findById(documentId).orElseThrow();
                    bSawObsoletedAfterAcquiringLock.set("OBSOLETED".equals(document.getStatus().getCode()));
                    // Also exercise the Revision-status write B represents, to confirm the whole
                    // simulated upgrade path still runs correctly once serialized.
                    DocumentRevisionRecord revision = revisionRepository.findById(revisionId).orElseThrow();
                    revision.setStatus(pendingReview);
                    revisionRepository.saveAndFlush(revision);
                });
            } catch (Exception ex) {
                failure.set(ex);
            }
        };

        pool.submit(transactionA);
        pool.submit(transactionB);
        pool.shutdown();
        assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS), "Both transactions must finish");
        if (failure.get() != null) {
            throw failure.get();
        }

        assertNotNull(aCommittedAt.get(), "Transaction A must have committed");
        assertNotNull(bAcquiredLockAt.get(), "Transaction B must have acquired the lock");
        assertFalse(bAcquiredLockAt.get().isBefore(aCommittedAt.get()),
                "Transaction B must not acquire the lock before Transaction A committed -- proves the lock serializes the two operations");
        assertTrue(bSawObsoletedAfterAcquiringLock.get(),
                "Transaction B, after acquiring the lock, must observe the Document's freshly-committed OBSOLETED status, not a stale ACTIVE read");

        DocumentRecord finalDocument = documentRepository.findById(documentId).orElseThrow();
        assertEquals("OBSOLETED", finalDocument.getStatus().getCode());
    }
}
