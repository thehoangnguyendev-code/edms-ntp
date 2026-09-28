package com.eqms;

import com.eqms.auth.TokenService;
import com.eqms.entity.*;
import com.eqms.exception.DocumentLifecycleConflictException;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.service.authorization.AuthorizationCutoverFlags;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;

/**
 * TC-DOC-051/052/053, production-path (per the FINAL CLOSURE TEST PASS instructions): exercises
 * the REAL DocumentService.obsoleteDocument and RevisionService.upgradeRevision, against the real
 * dev PostgreSQL instance, on genuinely independent threads/transactions. The retired bare-EXISTS
 * design is NOT re-tested here (see DocumentObsoleteConcurrencyTest for that architectural
 * regression proof only).
 *
 * Authorization services are @MockBean'd to (a) avoid depending on live permission-seed data,
 * which is orthogonal to the concurrency question, and (b) deliberately used as the ONE
 * synchronization point that lets this test force genuine overlap between the two transactions'
 * PRE-LOCK reads without instrumenting any production business-logic method. This is legitimate
 * test-double control, not a change to production behavior: the object under test is the real
 * lock/re-validation code in DocumentService/RevisionService, not the authorization decision
 * itself (which is exercised for real, and unconditionally allowed, in every case below).
 */
@SpringBootTest
class DocumentObsoleteUpgradeProductionPathConcurrencyTest {

    @Autowired private DocumentService documentService;
    @Autowired private RevisionService revisionService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private DocumentStatusDefinitionRepository documentStatusRepository;
    @Autowired private RevisionStatusDefinitionRepository revisionStatusRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private TokenService tokenService;

    @MockBean private DocumentAuthorizationService documentAuthorizationService;
    @MockBean private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;

    private UUID documentId;
    private UUID revisionId;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        // Authorization is real production concern but not the object under test here -- always
        // allow, for both the Document Obsolete and Revision Upgrade actions.
        doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(any(), any(), any());
        doNothing().when(revisionWorkflowAuthorizationService)
                .require(any(), any(), any(), any());
        // toDetailResponse(...) (called at the end of upgradeRevision/upgradeDocumentRevision to
        // build the response's capability flags) calls check(...) directly, bypassing require(...)
        // -- must be stubbed too or it NPEs on the mock's default null return.
        org.mockito.Mockito.lenient().when(revisionWorkflowAuthorizationService.check(any(), any(), any(), any()))
                .thenAnswer(invocation -> com.eqms.dto.security.WorkflowAuthorizationDecision.allowed(
                        invocation.getArgument(2), null, null, false, false));

        DocumentType type = documentTypeRepository.findAll().stream().findFirst().orElseThrow();
        BusinessUnit businessUnit = businessUnitRepository.findAll().stream().findFirst().orElseThrow();
        Department department = departmentRepository.findAll().stream().findFirst().orElseThrow();
        List<UserAccount> eligibleActors = userAccountRepository.findAll().stream()
                .filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm."))
                .toList();
        actor = eligibleActors.stream().findFirst().orElseThrow();
        // #13: copyWorkflowParticipantsFromDocument (invoked by upgradeRevision) now re-validates
        // SoD, including the unconditional "exactly one Approver" floor -- must be a distinct user
        // from the Document's Author (actor), since the real seeded dev-DB DocumentWorkflowSetting
        // also has authorCannotBeReviewerOrApprover=true.
        UserAccount approverActor = eligibleActors.stream().skip(1).findFirst().orElseThrow();
        DocumentStatusDefinition active = documentStatusRepository.findById("ACTIVE").orElseThrow();
        RevisionStatusDefinition effective = revisionStatusRepository.findById("EFFECTIVE").orElseThrow();

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentRecord document = new DocumentRecord();
            document.setDocumentNumber("PPCTEST." + UUID.randomUUID());
            document.setDocumentName("Production-Path Concurrency Test Document");
            document.setVersion("1.0.0");
            document.setStatus(active);
            document.setDocumentType(type);
            document.setBusinessUnit(businessUnit);
            document.setDepartment(department);
            document.setAuthor(actor);
            document.setOwner(actor);
            document.setTemplate(false);
            document.setHasRelatedDocuments(false);
            document.setHasCorrelatedDocuments(false);
            document.setRequiresTraining(false);
            documentRepository.save(document);
            documentId = document.getId();

            DocumentWorkflowParticipant approverParticipant = new DocumentWorkflowParticipant();
            approverParticipant.setDocument(document);
            approverParticipant.setParticipantType("APPROVER");
            approverParticipant.setSequenceOrder(1);
            approverParticipant.setUser(approverActor);
            documentWorkflowParticipantRepository.save(approverParticipant);

            DocumentRevisionRecord revision = new DocumentRevisionRecord();
            revision.setId(UUID.randomUUID());
            revision.setDocument(document);
            revision.setDocumentNumber(document.getDocumentNumber());
            revision.setDocumentName(document.getDocumentName());
            revision.setRevisionName(document.getDocumentName() + "_1.0.0");
            revision.setRevisionNumber("1.0.0");
            revision.setStatus(effective);
            revision.setDocumentType(type);
            revision.setBusinessUnit(businessUnit);
            revision.setDepartment(department);
            revision.setAuthor(actor);
            revision.setOwner(actor);
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

    @AfterEach
    void cleanup() {
        // Same DB-level discovery as DocumentObsoleteConcurrencyTest: physical deletion of
        // document_revisions/documents is blocked by a PostgreSQL trigger. Leave fixtures in a
        // harmless terminal state instead.
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

    private com.eqms.dto.document.DocumentObsoleteRequest obsoleteRequest() {
        String token = tokenService.createSignatureToken(actor);
        return new com.eqms.dto.document.DocumentObsoleteRequest("Production-path concurrency test", null, token);
    }

    private void runAsActor(Runnable body) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                actor.getId(), UUID.randomUUID(), actor.getUsername(),
                actor.getRoleName() != null ? actor.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, List.of());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            body.run();
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    /**
     * TEST ORDER B -- Obsolete wins the lock. Forces genuine overlap: Thread B (upgradeRevision)
     * is allowed to complete its PRE-LOCK reads (Document ACTIVE, Revision EFFECTIVE) and then is
     * suspended (via the authorization mock -- see class javadoc) BEFORE it reaches the lock.
     * While B is suspended, Thread A runs the real obsoleteDocument end-to-end and commits. B is
     * then released, reaches the lock (now free), and MUST re-validate against fresh state --
     * proving the fix -- and must NOT create a Draft Revision for a now-OBSOLETED Document.
     */
    @Test
    void obsoleteWinsLock_upgradeMustNotCreateDraftForNowObsoletedDocument() throws Exception {
        CountDownLatch bReachedPreLockReads = new CountDownLatch(1);
        CountDownLatch releaseB = new CountDownLatch(1);
        AtomicReference<Exception> aFailure = new AtomicReference<>();
        AtomicReference<Throwable> bOutcome = new AtomicReference<>();

        // B's authorization check runs AFTER B's pre-lock reads (source/document fetch) but BEFORE
        // B reaches the PESSIMISTIC_WRITE lock -- exactly the window this test needs to control.
        doAnswer(invocation -> {
            bReachedPreLockReads.countDown();
            assertTrue(releaseB.await(15, TimeUnit.SECONDS), "Test must release B before timing out");
            return null;
        }).when(revisionWorkflowAuthorizationService).require(any(), any(), any(), any());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        Runnable threadB = () -> runAsActor(() -> {
            try {
                System.out.println("[TEST-B] calling upgradeRevision");
                revisionService.upgradeRevision(revisionId);
                System.out.println("[TEST-B] upgradeRevision returned normally");
                bOutcome.set(null);
            } catch (Throwable t) {
                System.out.println("[TEST-B] upgradeRevision threw: " + t);
                bOutcome.set(t);
            }
        });
        Runnable threadA = () -> runAsActor(() -> {
            try {
                boolean reached = bReachedPreLockReads.await(10, TimeUnit.SECONDS);
                System.out.println("[TEST-A] B reached pre-lock reads: " + reached);
                documentService.obsoleteDocument(documentId, obsoleteRequest());
                System.out.println("[TEST-A] obsoleteDocument returned normally");
            } catch (Exception ex) {
                System.out.println("[TEST-A] obsoleteDocument threw: " + ex);
                aFailure.set(ex);
            } finally {
                releaseB.countDown();
            }
        });

        pool.submit(threadB);
        pool.submit(threadA);
        pool.shutdown();
        assertTrue(pool.awaitTermination(30, TimeUnit.SECONDS));

        if (aFailure.get() != null) {
            throw aFailure.get();
        }
        assertNotNull(bOutcome.get(), "B must fail once it resumes -- the Document is now OBSOLETED");
        assertTrue(
                bOutcome.get() instanceof IllegalArgumentException,
                "B must reject with the Document-not-ACTIVE guard, not silently create a Draft. Actual: " + bOutcome.get()
        );

        DocumentRecord finalDocument = documentRepository.findById(documentId).orElseThrow();
        assertEquals("OBSOLETED", finalDocument.getStatus().getCode(), "A must have committed its Obsolete");

        List<DocumentRevisionRecord> revisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId);
        assertEquals(1, revisions.size(), "No new Draft Revision may have been created by B");
        assertEquals("OBSOLETED", revisions.get(0).getStatus().getCode(), "The original Revision must be cascaded to OBSOLETED by A");
    }

    /**
     * TEST ORDER A -- Upgrade wins the lock. Thread B (upgradeRevision) is allowed to run
     * end-to-end and commit (new Draft Revision created) BEFORE Thread A's obsoleteDocument
     * reaches its own final precondition re-check. A must detect the new in-progress Revision and
     * reject with the approved 409 business-conflict semantics, performing no partial cascade.
     */
    @Test
    void upgradeWinsLock_obsoleteMustRejectOnceDraftExists() throws Exception {
        CountDownLatch bCommitted = new CountDownLatch(1);
        AtomicReference<Throwable> bOutcome = new AtomicReference<>();
        AtomicReference<Exception> aUnexpected = new AtomicReference<>();
        AtomicReference<DocumentLifecycleConflictException> aExpected = new AtomicReference<>();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        Runnable threadB = () -> runAsActor(() -> {
            try {
                revisionService.upgradeRevision(revisionId);
                bOutcome.set(null);
            } catch (Throwable t) {
                bOutcome.set(t);
            } finally {
                bCommitted.countDown();
            }
        });
        Runnable threadA = () -> runAsActor(() -> {
            try {
                assertTrue(bCommitted.await(15, TimeUnit.SECONDS), "B must commit before A attempts Obsolete");
                documentService.obsoleteDocument(documentId, obsoleteRequest());
            } catch (DocumentLifecycleConflictException expected) {
                aExpected.set(expected);
            } catch (Exception ex) {
                aUnexpected.set(ex);
            }
        });

        pool.submit(threadB);
        pool.submit(threadA);
        pool.shutdown();
        assertTrue(pool.awaitTermination(30, TimeUnit.SECONDS));

        assertNull(bOutcome.get(), "B (upgrade) must succeed uncontested since it acquired the lock first: " + bOutcome.get());
        if (aUnexpected.get() != null) {
            throw aUnexpected.get();
        }
        assertNotNull(aExpected.get(), "A must reject once B's Draft Revision is visible");
        assertEquals("DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS", aExpected.get().getCode());

        DocumentRecord finalDocument = documentRepository.findById(documentId).orElseThrow();
        assertEquals("ACTIVE", finalDocument.getStatus().getCode(), "Document must remain ACTIVE -- no partial cascade");

        List<DocumentRevisionRecord> revisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId);
        assertEquals(2, revisions.size(), "Original EFFECTIVE + B's new Draft");
        assertTrue(revisions.stream().anyMatch(r -> "DRAFT".equals(r.getStatus().getCode())));
        assertTrue(revisions.stream().anyMatch(r -> "EFFECTIVE".equals(r.getStatus().getCode())),
                "Original Revision must be untouched -- A performed no partial cascade");
    }
}
