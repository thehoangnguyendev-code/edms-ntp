package com.eqms;

import com.eqms.auth.TokenService;
import com.eqms.dto.document.DocumentCancelRequest;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentObsoleteRequest;
import com.eqms.entity.*;
import com.eqms.exception.AuthorizationDeniedException;
import com.eqms.exception.DocumentLifecycleConflictException;
import com.eqms.exception.GlobalExceptionHandler;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;

/**
 * Document Lifecycle Closure Batch D: real-DB baseline evidence for TC-DOC-001 through 007
 * (Create / Draft edit), TC-DOC-008/010-013 (Activation happy-path/idempotency), TC-DOC-014-022
 * (Cancel / reason validation), TC-DOC-023-025 (Cancel conflict incl. HTTP mapping), and
 * TC-DOC-068/069 (unauthorized Cancel/Obsolete) -- the ranges the Batch C report left NOT RUN.
 *
 * DocumentAuthorizationService is @SpyBean'd (not fully mocked): the AUTHORIZED actor's calls are
 * stubbed to bypass Access-Profile/permission-seed setup (orthogonal to what these tests verify),
 * while the UNAUTHORIZED actor (a freshly-created UserAccount with no Access Profile assignment)
 * hits the REAL authorization check, producing a genuine AccessDeniedException for TC-DOC-004/
 * 068/069 -- not a mocked one.
 */
@SpringBootTest
class DocumentLifecycleBaselineTest {

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
    @Autowired private DocumentSubTypeRepository documentSubTypeRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private ElectronicSignatureRepository electronicSignatureRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private TokenService tokenService;

    @SpyBean private DocumentAuthorizationService documentAuthorizationService;
    @SpyBean private ClamAvScanService clamAvScanService;
    @SpyBean private FileStorageService fileStorageService;

    private DocumentType type;
    private BusinessUnit businessUnit;
    private Department department;
    private UserAccount actor;
    private UserAccount reviewerActor;
    private UserAccount approverActor;
    private UserAccount unauthorizedActor;
    private DocumentStatusDefinition draft;
    private DocumentStatusDefinition active;
    private RevisionStatusDefinition effective;

    private final List<UUID> createdDocumentIds = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        type = documentTypeRepository.findAll().stream().filter(DocumentType::isActive).findFirst().orElseThrow();
        businessUnit = businessUnitRepository.findAll().stream().filter(BusinessUnit::isActive).findFirst().orElseThrow();
        department = departmentRepository.findAll().stream().filter(Department::isActive).findFirst().orElseThrow();
        // Excludes this test class's own previously-created unauthorizedActor rows (real, persisted,
        // permission-less accounts whose audit-trail references cannot be reassigned/deleted per
        // GMP immutability -- see AfterEach) from ever being selected as the AUTHORIZED actor.
        List<UserAccount> eligibleActors = userAccountRepository.findAll().stream()
                .filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm."))
                .toList();
        actor = eligibleActors.stream().findFirst().orElseThrow();
        // #13: copyWorkflowParticipantsFromDocument now re-validates SoD, and this dev DB's real
        // seeded DocumentWorkflowSetting has both "Author cannot be Reviewer/Approver" and "same
        // user cannot hold multiple workflow roles" enabled -- grantAsApproverAndReviewer(...) must
        // use accounts distinct from the Author (actor) and from each other, not actor itself.
        reviewerActor = eligibleActors.stream().skip(1).findFirst().orElseThrow();
        approverActor = eligibleActors.stream().skip(2).findFirst().orElseThrow();
        draft = documentStatusRepository.findById("DRAFT").orElseThrow();
        active = documentStatusRepository.findById("ACTIVE").orElseThrow();
        effective = revisionStatusRepository.findById("EFFECTIVE").orElseThrow();

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        unauthorizedActor = tx.execute(status -> {
            UserAccount u = new UserAccount();
            u.setUsername("baseline.noperm." + UUID.randomUUID());
            u.setEmail(UUID.randomUUID() + "@example.test");
            u.setFullName("No Permission Test User");
            u.setStatus(UserStatus.Active);
            u.setPasswordHash("$2a$10$Q7q0y6qz3nQ2QF6cGqk8n.T4mDx9J1Xb6mQpMwqzYh8kK1uT9y8gG");
            u.setRoleName("USER");
            return userAccountRepository.save(u);
        });

        // The AUTHORIZED actor bypasses Access-Profile setup (orthogonal); anyone else (in
        // particular unauthorizedActor) falls through to the real, unstubbed check.
        doNothing().when(documentAuthorizationService)
                .requireCanCreateDocument(argThat(u -> u != null && actor.getId().equals(u.getId())));
        // requireCanEditInitialDocumentDraft is deliberately NOT blanket-stubbed here: its
        // "must still be DRAFT" guard is exactly what TC-DOC-007 verifies, so each test that
        // needs the authorized-edit path stubs it per-document instead (see tcDoc005).
        doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(argThat(u -> u != null && actor.getId().equals(u.getId())), any(), any());
        doNothing().when(documentAuthorizationService)
                .requireCanUploadRevision(argThat(u -> u != null && actor.getId().equals(u.getId())), any());

        // MinIO/ClamAV in this dev environment are only reachable via docker-internal hostnames
        // that don't resolve from this host-run test JVM (same finding as TC-DOC-009's
        // DocumentActivationRollbackTest) -- out of scope for these baseline tests, stubbed the
        // same way.
        org.mockito.Mockito.lenient().doReturn(ClamAvScanService.ScanResult.ofClean())
                .when(clamAvScanService).scan(any());
        org.mockito.Mockito.lenient().doAnswer(invocation -> {
            try {
                byte[] content = invocation.getArgument(2, java.io.InputStream.class).readAllBytes();
                String checksum = java.util.HexFormat.of().formatHex(
                        java.security.MessageDigest.getInstance("SHA-256").digest(content));
                return new FileStorageService.StorageWriteResult(
                        null, "test-stub/" + UUID.randomUUID(), "MINIO", "test-bucket",
                        "test-object-key", "1", checksum);
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
        }).when(fileStorageService).storeRevisionSourceFile(any(), any(), any(), any(), any());

        runAsActor(actor);
    }

    @AfterEach
    void cleanup() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        DocumentStatusDefinition closedCancelled = documentStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        RevisionStatusDefinition closedCancelledRev = revisionStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            for (UUID documentId : createdDocumentIds) {
                if (closedCancelledRev != null) {
                    revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).forEach(r -> {
                        r.setStatus(closedCancelledRev);
                        revisionRepository.save(r);
                    });
                }
                if (closedCancelled != null) {
                    documentRepository.findById(documentId).ifPresent(d -> {
                        d.setStatus(closedCancelled);
                        documentRepository.save(d);
                    });
                }
            }
            // Cannot be deleted once it has acted (audit_logs.acted_by_user_id is immutable per
            // GMP) -- deactivate instead so status-filtered queries elsewhere never select it.
            if (unauthorizedActor != null) {
                userAccountRepository.findById(unauthorizedActor.getId()).ifPresent(u -> {
                    u.setStatus(UserStatus.Suspended);
                    userAccountRepository.save(u);
                });
            }
        });
    }

    private void runAsActor(UserAccount who) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                who.getId(), UUID.randomUUID(), who.getUsername(),
                who.getRoleName() != null ? who.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, List.of());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private DocumentDraftCreateRequest createRequest(String name) {
        return new DocumentDraftCreateRequest(
                name, null, type.getId().toString(), actor.getId().toString(),
                businessUnit.getId().toString(), department.getId().toString(),
                null, null, null, null, "English", false, null, "Not applicable for baseline test", null, null, null,
                null, null, false, null, null, null, null, null, null, null, null
        );
    }

    private DocumentRecord fetchDocument(UUID id) {
        DocumentRecord d = documentRepository.findById(id).orElseThrow();
        createdDocumentIds.add(id);
        return d;
    }

    private void grantAsApproverAndReviewer(DocumentRecord document) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentWorkflowParticipant approver = new DocumentWorkflowParticipant();
            approver.setDocument(document);
            approver.setParticipantType("APPROVER");
            approver.setUser(approverActor);
            approver.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(approver);

            DocumentWorkflowParticipant reviewer = new DocumentWorkflowParticipant();
            reviewer.setDocument(document);
            reviewer.setParticipantType("REVIEWER");
            reviewer.setUser(reviewerActor);
            reviewer.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(reviewer);
        });
    }

    // ------------------------------------------------------------------
    // TC-DOC-001/002/003/004: Create
    // ------------------------------------------------------------------

    @Test
    void tcDoc001_002_003_validCreate_isDraftWithSingleCreateAuditAndNoSignature() {
        long auditRowsBefore = auditLogRepository.count();

        var response = documentService.createDocumentDraft(createRequest("Baseline Create Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(response.id());
        DocumentRecord document = fetchDocument(documentId);

        // TC-DOC-001
        assertEquals("DRAFT", document.getStatus().getCode());

        // TC-DOC-002: exactly one CREATE audit row, null -> DRAFT
        List<AuditLog> auditRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId);
        List<AuditLog> createRows = auditRows.stream().filter(a -> "CREATE".equals(a.getActionType())).toList();
        assertEquals(1, createRows.size(), "Create must produce exactly one CREATE audit entry");
        assertNull(createRows.get(0).getFromStatus());
        assertEquals("DRAFT", createRows.get(0).getToStatus());
        assertEquals(auditRowsBefore + 1, auditLogRepository.count(), "Create must not produce any other audit entry");

        // TC-DOC-003: no ElectronicSignature row for Create
        assertTrue(electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", documentId).isEmpty());
    }

    @Test
    void tcDoc004_unauthorizedCreate_isRejectedWithNoDocumentAndNoAudit() {
        long documentCountBefore = documentRepository.count();
        long auditRowsBefore = auditLogRepository.count();

        runAsActor(unauthorizedActor);
        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> documentService.createDocumentDraft(createRequest("Should Not Be Created " + UUID.randomUUID())));

        assertEquals(documentCountBefore, documentRepository.count(), "No Document row may be persisted");
        assertEquals(auditRowsBefore, auditLogRepository.count(), "No audit entry may be created");

        // TC-DOC-004's "403": the same GlobalExceptionHandler mapping used for all AccessDeniedException.
        var handled = new GlobalExceptionHandler().handleAccessDenied(ex);
        assertEquals(HttpStatus.FORBIDDEN, handled.getStatusCode());
    }

    // ------------------------------------------------------------------
    // TC-DOC-005/007: Draft edit
    // ------------------------------------------------------------------

    @Test
    void tcDoc005_authorizedDraftEdit_succeedsAndRemainsDraft() {
        var created = documentService.createDocumentDraft(createRequest("Baseline Edit Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);

        doNothing().when(documentAuthorizationService)
                .requireCanEditInitialDocumentDraft(
                        argThat(u -> u != null && actor.getId().equals(u.getId())),
                        argThat(d -> d != null && documentId.equals(d.getId())));

        var updated = documentService.updateDocumentDraft(documentId, new DocumentDraftCreateRequest(
                "Updated Name " + UUID.randomUUID(), null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null
        ));

        DocumentRecord after = fetchDocument(documentId);
        assertEquals("DRAFT", after.getStatus().getCode());
        assertEquals(after.getDocumentName(), updated.documentName());
    }

    @Test
    void tcDoc006_subTypeChangeWithConsistentExistingReviewerSet_isAccepted() {
        UserAccount reviewer = userAccountRepository.findAll().stream()
                .filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm."))
                .filter(u -> !u.getId().equals(actor.getId()))
                .findFirst().orElseThrow();

        var created = documentService.createDocumentDraft(createRequest("Baseline SubType Reviewer Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);

        doNothing().when(documentAuthorizationService)
                .requireCanEditInitialDocumentDraft(
                        argThat(u -> u != null && actor.getId().equals(u.getId())),
                        argThat(d -> d != null && documentId.equals(d.getId())));

        // Existing reviewer set assigned directly (bypassing the separate
        // documents.document.configure_initial_workflow permission gate on saveDraftAssignments,
        // which is orthogonal to the Sub-Type/reviewer CONSISTENCY rule this test verifies).
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentWorkflowParticipant reviewerParticipant = new DocumentWorkflowParticipant();
            reviewerParticipant.setDocument(document);
            reviewerParticipant.setParticipantType("REVIEWER");
            reviewerParticipant.setUser(reviewer);
            reviewerParticipant.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(reviewerParticipant);
        });

        // A Sub-Type requiring review (REQUIRED) -- the existing single-Reviewer set already
        // satisfies this, so the change must be ACCEPTED, not rejected.
        DocumentSubType subType = new DocumentSubType();
        subType.setName("Baseline Consistent SubType " + UUID.randomUUID());
        subType.setDocumentType(type);
        subType.setReviewRequirement(ReviewRequirement.REQUIRED);
        subType.setActive(true);
        tx.executeWithoutResult(status -> documentSubTypeRepository.save(subType));

        // reviewerUserIds=null (the normal "Save & Next" Sub-Type-only save) deliberately leaves
        // the Reviewer set untouched -- exercising the actual re-validation branch this TC covers.
        var updated = documentService.updateDocumentDraft(documentId, new DocumentDraftCreateRequest(
                null, null, null, null, null, null,
                null, subType.getName(), null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null
        ));

        DocumentRecord after = fetchDocument(documentId);
        assertEquals("DRAFT", after.getStatus().getCode());
        assertEquals(subType.getName(), after.getSubType());
        assertNotNull(updated);
        List<DocumentWorkflowParticipant> reviewersAfter = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "REVIEWER");
        assertEquals(1, reviewersAfter.size());
        assertEquals(reviewer.getId(), reviewersAfter.get(0).getUser().getId());
    }

    @Test
    void tcDoc006b_switchToNoReviewSubTypeWhileSavedReviewersExist_isRejected() {
        // Decision D3 (change record review-requirement-snapshot-and-subtype-fk): the system must
        // NOT silently drop saved reviewers. Switching a Draft to a Sub-Type that does not use
        // review while it still has SAVED reviewers is rejected with a stable, actionable code.
        UserAccount reviewer = userAccountRepository.findAll().stream()
                .filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm."))
                .filter(u -> !u.getId().equals(actor.getId()))
                .findFirst().orElseThrow();

        var created = documentService.createDocumentDraft(createRequest("Baseline D3 Reject Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);

        doNothing().when(documentAuthorizationService)
                .requireCanEditInitialDocumentDraft(
                        argThat(u -> u != null && actor.getId().equals(u.getId())),
                        argThat(d -> d != null && documentId.equals(d.getId())));

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentWorkflowParticipant reviewerParticipant = new DocumentWorkflowParticipant();
            reviewerParticipant.setDocument(document);
            reviewerParticipant.setParticipantType("REVIEWER");
            reviewerParticipant.setUser(reviewer);
            reviewerParticipant.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(reviewerParticipant);
        });

        DocumentSubType noReviewSubType = new DocumentSubType();
        noReviewSubType.setName("Baseline NoReview SubType " + UUID.randomUUID());
        noReviewSubType.setDocumentType(type);
        noReviewSubType.setReviewRequirement(ReviewRequirement.NONE);
        noReviewSubType.setActive(true);
        tx.executeWithoutResult(status -> documentSubTypeRepository.save(noReviewSubType));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                documentService.updateDocumentDraft(documentId, new DocumentDraftCreateRequest(
                        null, null, null, null, null, null,
                        null, noReviewSubType.getName(), null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null, null
                )));
        assertTrue(ex.getMessage() != null && ex.getMessage().startsWith("REVIEWERS_MUST_BE_REMOVED_FIRST"),
                "Expected REVIEWERS_MUST_BE_REMOVED_FIRST, got: " + ex.getMessage());

        // Neither the Sub-Type nor the reviewer roster may have changed.
        DocumentRecord after = fetchDocument(documentId);
        assertNotEquals(noReviewSubType.getName(), after.getSubType());
        List<DocumentWorkflowParticipant> reviewersAfter = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "REVIEWER");
        assertEquals(1, reviewersAfter.size());
    }

    @Test
    void tcDoc006c_reviewRequirementIsFrozenSnapshot_laterSubTypePolicyEditDoesNotAffectDraft() {
        // Decision D1: documents.review_requirement is snapshotted when the Sub-Type is set and is
        // never recomputed. An admin flipping the Sub-Type's policy afterwards must not change the
        // rule for a Draft already in flight.
        var created = documentService.createDocumentDraft(createRequest("Baseline D1 Snapshot Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        fetchDocument(documentId);

        doNothing().when(documentAuthorizationService)
                .requireCanEditInitialDocumentDraft(
                        argThat(u -> u != null && actor.getId().equals(u.getId())),
                        argThat(d -> d != null && documentId.equals(d.getId())));

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        DocumentSubType subType = new DocumentSubType();
        subType.setName("Baseline Snapshot SubType " + UUID.randomUUID());
        subType.setDocumentType(type);
        subType.setReviewRequirement(ReviewRequirement.REQUIRED);
        subType.setActive(true);
        tx.executeWithoutResult(status -> documentSubTypeRepository.save(subType));

        documentService.updateDocumentDraft(documentId, new DocumentDraftCreateRequest(
                null, null, null, null, null, null,
                null, subType.getName(), null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null
        ));

        DocumentRecord afterSet = fetchDocument(documentId);
        assertEquals(ReviewRequirement.REQUIRED, afterSet.getReviewRequirement());
        assertEquals(subType.getId(), afterSet.getSubTypeId(), "Sub-Type is referenced by id (rename-safe)");

        // Admin flips the Sub-Type's policy after the Draft already snapshotted it.
        tx.executeWithoutResult(status -> {
            DocumentSubType st = documentSubTypeRepository.findById(subType.getId()).orElseThrow();
            st.setReviewRequirement(ReviewRequirement.NONE);
            documentSubTypeRepository.save(st);
        });

        DocumentRecord afterPolicyEdit = documentRepository.findById(documentId).orElseThrow();
        assertEquals(ReviewRequirement.REQUIRED, afterPolicyEdit.getReviewRequirement(),
                "In-flight Draft keeps its frozen review requirement; not recomputed from the Sub-Type");
    }

    @Test
    void tcDoc006d_concurrentSwitchToNoReviewSubType_neverLeavesNoneWithSavedReviewer() throws Exception {
        // Concurrency evidence for D1/D3: two parallel updateDocumentDraft calls both switching the
        // Draft to a NONE-review Sub-Type while a saved reviewer exists. Whatever the interleaving
        // (both rejected by the D3 guard, or one lost to optimistic locking on `documents`), the
        // end state must never be review_requirement=NONE with a REVIEWER still persisted.
        UserAccount reviewer = userAccountRepository.findAll().stream()
                .filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm."))
                .filter(u -> !u.getId().equals(actor.getId()))
                .findFirst().orElseThrow();

        var created = documentService.createDocumentDraft(createRequest("Baseline D3 Concurrency Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);

        doNothing().when(documentAuthorizationService)
                .requireCanEditInitialDocumentDraft(
                        argThat(u -> u != null && actor.getId().equals(u.getId())),
                        argThat(d -> d != null && documentId.equals(d.getId())));

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentWorkflowParticipant reviewerParticipant = new DocumentWorkflowParticipant();
            reviewerParticipant.setDocument(document);
            reviewerParticipant.setParticipantType("REVIEWER");
            reviewerParticipant.setUser(reviewer);
            reviewerParticipant.setSequenceOrder(1);
            documentWorkflowParticipantRepository.save(reviewerParticipant);
        });

        DocumentSubType noReviewSubType = new DocumentSubType();
        noReviewSubType.setName("Baseline NoReview Concurrent SubType " + UUID.randomUUID());
        noReviewSubType.setDocumentType(type);
        noReviewSubType.setReviewRequirement(ReviewRequirement.NONE);
        noReviewSubType.setActive(true);
        tx.executeWithoutResult(status -> documentSubTypeRepository.save(noReviewSubType));

        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.Callable<Throwable> task = () -> {
            start.await();
            runAsActor(actor);
            try {
                documentService.updateDocumentDraft(documentId, new DocumentDraftCreateRequest(
                        null, null, null, null, null, null,
                        null, noReviewSubType.getName(), null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null, null
                ));
                return null;
            } catch (Throwable t) {
                return t;
            }
        };
        var f1 = pool.submit(task);
        var f2 = pool.submit(task);
        start.countDown();
        Throwable r1 = f1.get(30, java.util.concurrent.TimeUnit.SECONDS);
        Throwable r2 = f2.get(30, java.util.concurrent.TimeUnit.SECONDS);
        pool.shutdown();

        // At least one must have been rejected; neither may have succeeded in setting NONE.
        assertTrue(r1 != null || r2 != null, "Concurrent NONE switch with a saved reviewer must not both succeed");

        DocumentRecord after = documentRepository.findById(documentId).orElseThrow();
        long reviewerCount = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "REVIEWER").size();
        assertFalse(after.getReviewRequirement() == ReviewRequirement.NONE && reviewerCount > 0,
                "Invariant violated: review_requirement=NONE while a saved reviewer remains");
        assertEquals(1, reviewerCount, "Saved reviewer must not have been silently removed");
    }

    @Test
    void tcDoc007_editWhenNotDraft_isRejected() {
        var created = documentService.createDocumentDraft(createRequest("Baseline Non-Draft Edit Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            document.setStatus(active);
            documentRepository.save(document);
        });

        assertThrows(AccessDeniedException.class, () -> documentService.updateDocumentDraft(documentId, createRequest("Should Fail")));
    }

    // ------------------------------------------------------------------
    // TC-DOC-008/010/011/012: Activation (real end-to-end upload path)
    // ------------------------------------------------------------------

    @Test
    void tcDoc008_010_011_firstSourceUpload_activatesDraftWithAuditAndNoSignature() throws Exception {
        var created = documentService.createDocumentDraft(createRequest("Baseline Activation Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);
        grantAsApproverAndReviewer(document);

        long auditRowsBefore = auditLogRepository.count();

        var revisionResponse = revisionService.createRevisionAndUploadFile(documentId, buildMinimalValidDocxFile(), null);

        DocumentRecord after = fetchDocument(documentId);
        // TC-DOC-008
        assertEquals("ACTIVE", after.getStatus().getCode());

        // TC-DOC-010: ACTIVATE audit contains Document id/DRAFT/ACTIVE/triggering-revision id.
        List<AuditLog> activateRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId)
                .stream().filter(a -> "ACTIVATE".equals(a.getActionType())).toList();
        assertEquals(1, activateRows.size());
        AuditLog activateRow = activateRows.get(0);
        assertEquals("DRAFT", activateRow.getFromStatus());
        assertEquals("ACTIVE", activateRow.getToStatus());
        assertNotNull(activateRow.getUsername());
        assertNotNull(activateRow.getCreatedAt());
        assertTrue(activateRow.getReason() != null && activateRow.getReason().contains(revisionResponse.id()),
                "Activation audit must reference the triggering Revision");

        // TC-DOC-011: activation itself requires no electronic signature.
        assertTrue(electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", documentId).isEmpty());
        assertTrue(auditLogRepository.count() > auditRowsBefore);
    }

    @Test
    void tcDoc012_activationIsIdempotent_alreadyActiveDocumentIsNotReActivated() throws Exception {
        var created = documentService.createDocumentDraft(createRequest("Baseline Idempotent Activation Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);
        grantAsApproverAndReviewer(document);

        var revisionResponse = revisionService.createRevisionAndUploadFile(documentId, buildMinimalValidDocxFile(), null);
        long activateRowsAfterFirst = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId)
                .stream().filter(a -> "ACTIVATE".equals(a.getActionType())).count();
        assertEquals(1, activateRowsAfterFirst);

        // Document is already ACTIVE and its (only) Revision is not a parentless-initial Revision
        // relative to itself -- re-invoking the same activation routine directly (the guarded
        // production method every upload path calls through) on the already-ACTIVE Document must
        // be a no-op: it only ever activates a DRAFT Document, and only for a parentless Revision.
        DocumentRevisionRecord revision = revisionRepository.findById(UUID.fromString(revisionResponse.id())).orElseThrow();
        DocumentRecord nowActiveDocument = documentRepository.findById(documentId).orElseThrow();
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                revisionService, "activateDocumentAfterInitialSourceStored", nowActiveDocument, revision, actor);

        long activateRowsAfterSecond = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId)
                .stream().filter(a -> "ACTIVATE".equals(a.getActionType())).count();
        assertEquals(1, activateRowsAfterSecond, "Re-invoking activation on an already-ACTIVE Document must not produce a second ACTIVATE audit entry");
        assertEquals("ACTIVE", fetchDocument(documentId).getStatus().getCode());
    }

    @Test
    void tcDoc013_rejectedSourceUpload_documentRemainsDraftNoActivation() {
        var created = documentService.createDocumentDraft(createRequest("Baseline Rejected Upload Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);
        grantAsApproverAndReviewer(document);

        long auditRowsBefore = auditLogRepository.count();

        // A deterministic, pre-storage rejection: RevisionUploadFileValidator rejects this before
        // any Revision row is created and before activateDocumentAfterInitialSourceStored is ever
        // reached (unlike TC-DOC-009, which proves rollback AFTER that mutation already ran).
        org.springframework.mock.web.MockMultipartFile invalidFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "not-a-docx.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "this is not a valid docx/zip file".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertThrows(RuntimeException.class,
                () -> revisionService.createRevisionAndUploadFile(documentId, invalidFile, null));

        DocumentRecord after = fetchDocument(documentId);
        assertEquals("DRAFT", after.getStatus().getCode(), "Document must remain DRAFT -- activation must never be reached");
        assertTrue(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId).isEmpty(),
                "No Revision row may persist from the rejected upload attempt");
        List<AuditLog> activateRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId)
                .stream().filter(a -> "ACTIVATE".equals(a.getActionType())).toList();
        assertTrue(activateRows.isEmpty(), "No ACTIVATE audit entry may be created for a rejected upload");
        assertTrue(electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", documentId).isEmpty());
        // A security-audit entry recording the REJECTED upload attempt itself is legitimate (and
        // expected) -- what must never appear is an ACTIVATE entry (already asserted above).
        assertTrue(auditLogRepository.count() >= auditRowsBefore);
    }

    @Test
    void tcDoc014_nextRevisionNotConfigurableOnceInProgressDraftCompletedAuthoring() throws Exception {
        // The DCO's "Edit Revision for Upgrade" / next-revision configuration must stop being
        // offered once the in-progress upgrade Draft has completed authoring and its source is
        // locked -- even for a MinIO-only revision that was never opened in Office Online (so the
        // existing storageItemId/storageDriveId check does not catch it). Otherwise reviewer/
        // approver/related changes would be saved on the Document but never reach the Draft the
        // Author already signed off (syncDraftRevisionWithDocument skips COMPLETED drafts).
        var created = documentService.createDocumentDraft(createRequest("Baseline Configurable Guard Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        DocumentRecord document = fetchDocument(documentId);
        grantAsApproverAndReviewer(document);
        revisionService.createRevisionAndUploadFile(documentId, buildMinimalValidDocxFile(), null);

        DocumentRecord activeDocument = documentRepository.findById(documentId).orElseThrow();
        RevisionStatusDefinition draftStatus = revisionStatusRepository.findById("DRAFT").orElseThrow();
        UUID inProgressRevisionId = revisionRepository
                .findAllByDocument_IdOrderByCreatedAtDesc(documentId).stream()
                .findFirst().orElseThrow().getId();

        TransactionTemplate tx = new TransactionTemplate(transactionManager);

        // Put the in-progress revision back to a genuinely early-stage Draft: still authoring, no
        // Office Online working copy. It must be configurable here.
        tx.executeWithoutResult(status -> {
            DocumentRevisionRecord d = revisionRepository.findById(inProgressRevisionId).orElseThrow();
            d.setStatus(draftStatus);
            d.setEditingStatus("IN_PROGRESS");
            d.setSourceLocked(false);
            d.setStorageItemId(null);
            d.setStorageDriveId(null);
            revisionRepository.save(d);
        });
        assertTrue(documentService.isNextRevisionConfigurable(activeDocument),
                "An early-stage Draft (authoring in progress, no Office Online copy) must be configurable");

        // Author completes authoring -> editingStatus COMPLETED + source locked, status stays DRAFT,
        // and there is still NO storageItemId/storageDriveId (MinIO-only revision).
        tx.executeWithoutResult(status -> {
            DocumentRevisionRecord d = revisionRepository.findById(inProgressRevisionId).orElseThrow();
            d.setEditingStatus("COMPLETED");
            d.setSourceLocked(true);
            revisionRepository.save(d);
        });
        assertFalse(documentService.isNextRevisionConfigurable(activeDocument),
                "Next revision must not be configurable once the in-progress Draft completed authoring");
    }

    private org.springframework.mock.web.MockMultipartFile buildMinimalValidDocxFile() throws Exception {
        java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
        try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(buffer)) {
            zip.putNextEntry(new java.util.zip.ZipEntry("[Content_Types].xml"));
            zip.write(("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                    </Types>
                    """).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new java.util.zip.ZipEntry("word/document.xml"));
            zip.write(("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>
                    """).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return new org.springframework.mock.web.MockMultipartFile(
                "file", "test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer.toByteArray());
    }

    // ------------------------------------------------------------------
    // TC-DOC-014 through 022: Cancel + reason validation
    // ------------------------------------------------------------------

    private UUID newDraftDocumentWithNoRevision() {
        var created = documentService.createDocumentDraft(createRequest("Baseline Cancel Test " + UUID.randomUUID()));
        UUID documentId = UUID.fromString(created.id());
        fetchDocument(documentId);
        return documentId;
    }

    @Test
    void tcDoc014_zeroRevisionCancelWithValidReason_becomesClosedCancelled() {
        UUID documentId = newDraftDocumentWithNoRevision();
        documentService.cancelDocument(documentId, new DocumentCancelRequest("Discontinued per QA"));
        assertEquals("CLOSED_CANCELLED", fetchDocument(documentId).getStatus().getCode());
    }

    @Test
    void tcDoc015_cancelRequiresNoElectronicSignature() {
        UUID documentId = newDraftDocumentWithNoRevision();
        documentService.cancelDocument(documentId, new DocumentCancelRequest("Discontinued per QA"));
        assertTrue(electronicSignatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc("documents", documentId).isEmpty());
    }

    @Test
    void tcDoc016_020_auditReasonEqualsTrimmedActorEnteredText() {
        UUID documentId = newDraftDocumentWithNoRevision();
        documentService.cancelDocument(documentId, new DocumentCancelRequest("  Discontinued per QA  "));

        List<AuditLog> cancelRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId)
                .stream().filter(a -> "CANCEL".equals(a.getActionType())).toList();
        assertEquals(1, cancelRows.size());
        assertEquals("Discontinued per QA", cancelRows.get(0).getReason(),
                "Reason must be the actor-entered text, trimmed -- not padded, not a fallback default");
    }

    @Test
    void tcDoc017_nullReason_isRejected() {
        UUID documentId = newDraftDocumentWithNoRevision();
        assertThrows(IllegalArgumentException.class, () -> documentService.cancelDocument(documentId, new DocumentCancelRequest(null)));
        assertEquals("DRAFT", fetchDocument(documentId).getStatus().getCode());
    }

    @Test
    void tcDoc018_emptyReason_isRejected() {
        UUID documentId = newDraftDocumentWithNoRevision();
        assertThrows(IllegalArgumentException.class, () -> documentService.cancelDocument(documentId, new DocumentCancelRequest("")));
        assertEquals("DRAFT", fetchDocument(documentId).getStatus().getCode());
    }

    @Test
    void tcDoc019_whitespaceOnlyReason_isRejected() {
        UUID documentId = newDraftDocumentWithNoRevision();
        assertThrows(IllegalArgumentException.class, () -> documentService.cancelDocument(documentId, new DocumentCancelRequest("   ")));
        assertEquals("DRAFT", fetchDocument(documentId).getStatus().getCode());
    }

    @Test
    void tcDoc021_noSilentFallbackToDefaultReasonString() {
        UUID documentId = newDraftDocumentWithNoRevision();
        assertThrows(IllegalArgumentException.class, () -> documentService.cancelDocument(documentId, new DocumentCancelRequest("")));
        List<AuditLog> cancelRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId)
                .stream().filter(a -> "CANCEL".equals(a.getActionType())).toList();
        assertTrue(cancelRows.isEmpty(), "A rejected blank-reason Cancel must not produce any CANCEL audit row (e.g. with a fallback 'Document cancelled' reason)");
    }

    @Test
    void tcDoc022_cancelReasonHasNoMaxLength_storedInFull() {
        // The workflow reason has no business max length. AuditTrailService.persistAudit writes it
        // into AuditLog.reason and AuditLog.comment, both TEXT (see V412) -- the former incidental
        // varchar(1024) cap on `comment` was removed because an over-long reason must never abort
        // the audit INSERT (which rolled back the whole Cancel, or silently dropped the audit row
        // via logSafely). A very long reason is accepted and persisted verbatim.
        UUID atLimitDocumentId = newDraftDocumentWithNoRevision();
        String reason1024 = "A".repeat(1024);
        documentService.cancelDocument(atLimitDocumentId, new DocumentCancelRequest(reason1024));
        List<AuditLog> rows1024 = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", atLimitDocumentId)
                .stream().filter(a -> "CANCEL".equals(a.getActionType())).toList();
        assertEquals(1, rows1024.size());
        assertEquals(reason1024, rows1024.get(0).getReason());
        assertEquals(reason1024, rows1024.get(0).getComment());

        UUID longDocumentId = newDraftDocumentWithNoRevision();
        String reason5000 = "A".repeat(5000);
        documentService.cancelDocument(longDocumentId, new DocumentCancelRequest(reason5000));
        assertEquals("CLOSED_CANCELLED", fetchDocument(longDocumentId).getStatus().getCode(),
                "A long reason must not block the Cancel");
        List<AuditLog> longRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", longDocumentId)
                .stream().filter(a -> "CANCEL".equals(a.getActionType())).toList();
        assertEquals(1, longRows.size());
        assertEquals(reason5000, longRows.get(0).getReason(), "The full reason is stored, not truncated");
        assertEquals(reason5000, longRows.get(0).getComment());
    }

    // ------------------------------------------------------------------
    // TC-DOC-023/024/025: Cancel conflict (existing Revision)
    // ------------------------------------------------------------------

    @Test
    void tcDoc023_024_025_cancelWithExistingRevision_isRejectedWith409UnchangedDocument() {
        UUID documentId = newDraftDocumentWithNoRevision();
        DocumentRecord beforeDocument = fetchDocument(documentId);
        String statusBefore = beforeDocument.getStatus().getCode();
        String versionBefore = beforeDocument.getVersion();

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(beforeDocument);
        revision.setDocumentNumber(beforeDocument.getDocumentNumber());
        revision.setDocumentName(beforeDocument.getDocumentName());
        revision.setRevisionName(beforeDocument.getDocumentName() + "_0.0.1");
        revision.setRevisionNumber("0.0.1");
        revision.setStatus(revisionStatusRepository.findById("DRAFT").orElseThrow());
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
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> revisionRepository.save(revision));

        DocumentLifecycleConflictException ex = assertThrows(DocumentLifecycleConflictException.class,
                () -> documentService.cancelDocument(documentId, new DocumentCancelRequest("Attempted cancel")));
        // TC-DOC-023
        assertEquals("DOCUMENT_CANCEL_NOT_ALLOWED", ex.getCode());

        // TC-DOC-024: Document row unchanged (status + version, the only lifecycle-relevant fields
        // this action could have touched).
        DocumentRecord afterDocument = fetchDocument(documentId);
        assertEquals(statusBefore, afterDocument.getStatus().getCode());
        assertEquals(versionBefore, afterDocument.getVersion());
        assertNull(afterDocument.getCancelledAt());

        // TC-DOC-025: never a generic 500 -- the same GlobalExceptionHandler mapping already
        // verified for Obsolete's DocumentLifecycleConflictException (Batch A) applies identically
        // here since Cancel throws the same exception class.
        var handled = new GlobalExceptionHandler().handleDocumentLifecycleConflict(ex);
        assertEquals(HttpStatus.CONFLICT, handled.getStatusCode());
        assertEquals("DOCUMENT_CANCEL_NOT_ALLOWED", handled.getBody().error().code());
    }

    // ------------------------------------------------------------------
    // TC-DOC-068/069: unauthorized Cancel/Obsolete
    // ------------------------------------------------------------------

    @Test
    void tcDoc068_unauthorizedCancel_isRejectedDocumentUnchanged() {
        UUID documentId = newDraftDocumentWithNoRevision();
        DocumentRecord before = fetchDocument(documentId);
        String statusBefore = before.getStatus().getCode();

        runAsActor(unauthorizedActor);
        AuthorizationDeniedException ex = assertThrows(AuthorizationDeniedException.class,
                () -> documentService.cancelDocument(documentId, new DocumentCancelRequest("Should not be allowed")));

        assertEquals(statusBefore, fetchDocument(documentId).getStatus().getCode());
        assertEquals(HttpStatus.FORBIDDEN, new GlobalExceptionHandler().handleAuthorizationDenied(ex).getStatusCode());
    }

    @Test
    void tcDoc069_unauthorizedObsolete_isRejectedDocumentUnchangedSignatureNotConsumed() {
        DocumentRecord document = new DocumentRecord();
        document.setDocumentNumber("TCDOC069." + UUID.randomUUID());
        document.setDocumentName("Baseline Unauthorized Obsolete Test");
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
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> documentRepository.save(document));
        createdDocumentIds.add(document.getId());

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
        tx.executeWithoutResult(status -> revisionRepository.save(revision));

        String signatureToken = tokenService.createSignatureToken(unauthorizedActor);

        runAsActor(unauthorizedActor);
        assertThrows(AuthorizationDeniedException.class, () -> documentService.obsoleteDocument(
                document.getId(),
                new DocumentObsoleteRequest("Should not be allowed", null, signatureToken)
        ));

        assertEquals("ACTIVE", fetchDocument(document.getId()).getStatus().getCode());

        // Signature token must not have been consumed by the rejected (unauthorized) attempt: the
        // SAME token, retried as the SAME actor once authorization is satisfied, must still
        // succeed. Authorization for unauthorizedActor is stubbed only for this retry -- proving
        // the token itself (not the actor's authorization) is what changed.
        doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(argThat(u -> u != null && unauthorizedActor.getId().equals(u.getId())), any(), any());
        doNothing().when(documentAuthorizationService)
                .requireCanViewDocument(argThat(u -> u != null && unauthorizedActor.getId().equals(u.getId())), any());
        documentService.obsoleteDocument(document.getId(), new DocumentObsoleteRequest("Now authorized", null, signatureToken));
        assertEquals("OBSOLETED", fetchDocument(document.getId()).getStatus().getCode());
    }
}
