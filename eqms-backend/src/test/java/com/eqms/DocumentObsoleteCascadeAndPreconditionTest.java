package com.eqms;

import com.eqms.auth.TokenService;
import com.eqms.dto.document.DocumentObsoleteRequest;
import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.entity.*;
import com.eqms.exception.DocumentLifecycleConflictException;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;

/**
 * Document Lifecycle Closure Batch A: TC-DOC-026 through TC-DOC-050 (backend lifecycle / cascade /
 * atomicity only -- no notification or frontend work, per instructions). Exercises the real
 * DocumentService.obsoleteDocument and the real ControlledCopyLifecycleObsolescenceService /
 * RevisionService.publishRevision production paths against the real dev PostgreSQL instance.
 *
 * Authorization services are @MockBean'd to always-allow (same pattern as
 * DocumentObsoleteUpgradeProductionPathConcurrencyTest) since authorization is an orthogonal,
 * already-covered concern -- not the object under test here.
 */
@SpringBootTest
class DocumentObsoleteCascadeAndPreconditionTest {

    @Autowired private DocumentService documentService;
    @Autowired private RevisionService revisionService;
    @Autowired private ControlledCopyLifecycleObsolescenceService controlledCopyLifecycleObsolescenceService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private ControlledCopyRepository controlledCopyRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private ElectronicSignatureRepository electronicSignatureRepository;
    @Autowired private DocumentStatusDefinitionRepository documentStatusRepository;
    @Autowired private RevisionStatusDefinitionRepository revisionStatusRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private TokenService tokenService;

    @MockBean private DocumentAuthorizationService documentAuthorizationService;
    @MockBean private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    @SpyBean private AuditTrailService auditTrailService;

    private DocumentType type;
    private BusinessUnit businessUnit;
    private Department department;
    private UserAccount actor;
    private DocumentStatusDefinition active;
    private RevisionStatusDefinition effective;

    private final List<UUID> createdDocumentIds = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(any(), any(), any());
        doNothing().when(revisionWorkflowAuthorizationService)
                .require(any(), any(), any(), any());
        org.mockito.Mockito.lenient().when(revisionWorkflowAuthorizationService.check(any(), any(), any(), any()))
                .thenAnswer(invocation -> com.eqms.dto.security.WorkflowAuthorizationDecision.allowed(
                        invocation.getArgument(2), null, null, false, false));

        type = documentTypeRepository.findAll().stream().findFirst().orElseThrow();
        businessUnit = businessUnitRepository.findAll().stream().findFirst().orElseThrow();
        department = departmentRepository.findAll().stream().findFirst().orElseThrow();
        actor = userAccountRepository.findAll().stream().filter(u -> u.getUsername() == null || !u.getUsername().startsWith("baseline.noperm.")).findFirst().orElseThrow();
        active = documentStatusRepository.findById("ACTIVE").orElseThrow();
        effective = revisionStatusRepository.findById("EFFECTIVE").orElseThrow();

        var principal = new com.eqms.auth.AuthenticatedUser(
                actor.getId(), UUID.randomUUID(), actor.getUsername(),
                actor.getRoleName() != null ? actor.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, List.of());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void cleanup() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        DocumentStatusDefinition closedCancelledDoc = documentStatusRepository.findById("CLOSED_CANCELLED").orElse(null);
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
                if (closedCancelledDoc != null) {
                    documentRepository.findById(documentId).ifPresent(d -> {
                        d.setStatus(closedCancelledDoc);
                        documentRepository.save(d);
                    });
                }
            }
        });
    }

    private DocumentRecord newActiveDocument(String prefix) {
        DocumentRecord document = new DocumentRecord();
        document.setDocumentNumber(prefix + "." + UUID.randomUUID());
        document.setDocumentName(prefix + " Test Document");
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
        createdDocumentIds.add(document.getId());
        return document;
    }

    private DocumentRevisionRecord newRevision(DocumentRecord document, RevisionStatusDefinition status, String revisionNumber) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        revision.setDocumentNumber(document.getDocumentNumber());
        revision.setDocumentName(document.getDocumentName());
        revision.setRevisionName(document.getDocumentName() + "_" + revisionNumber);
        revision.setRevisionNumber(revisionNumber);
        revision.setStatus(status);
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
        return revision;
    }

    private ControlledCopyRecord newControlledCopy(DocumentRecord document, DocumentRevisionRecord revision, String statusCode, int copyNumber) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setRevision(revision);
        copy.setControlledCopyNumber(document.getDocumentNumber() + "-CC-" + copyNumber + "-" + UUID.randomUUID().toString().substring(0, 8));
        copy.setCopyNumber(copyNumber);
        copy.setTotalCopies(1);
        copy.setDocumentNumber(document.getDocumentNumber());
        copy.setStatus(statusCode);
        copy.setStatusCode(statusCode);
        copy.setCurrentStage(statusCode);
        copy.setDownloadCount(0);
        copy.setPrintCount(0);
        copy.setHasExpiryDate(false);
        if ("DISTRIBUTED".equals(statusCode)) {
            copy.setDistributedBy(actor);
            copy.setDistributedAt(Instant.now());
        }
        controlledCopyRepository.save(copy);
        return copy;
    }

    private DocumentObsoleteRequest obsoleteRequest() {
        return new DocumentObsoleteRequest("Batch A test reason", null, tokenService.createSignatureToken(actor));
    }

    // ------------------------------------------------------------------
    // TC-DOC-026 through TC-DOC-032: Obsolete precondition violations
    // ------------------------------------------------------------------

    @Test
    void tcDoc026_documentNotActive_isRejected() {
        DocumentRecord document = newActiveDocument("TCDOC026");
        newRevision(document, effective, "1.0.0");
        DocumentStatusDefinition draft = documentStatusRepository.findById("DRAFT").orElseThrow();
        document.setStatus(draft);
        documentRepository.save(document);

        DocumentLifecycleConflictException ex = assertThrows(DocumentLifecycleConflictException.class,
                () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest()));
        assertEquals("DOCUMENT_OBSOLETE_NOT_ACTIVE", ex.getCode());

        DocumentRecord after = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("DRAFT", after.getStatus().getCode(), "Document status must not change on rejection");
    }

    @Test
    void tcDoc027_noEffectiveRevision_isRejected() {
        DocumentRecord document = newActiveDocument("TCDOC027");
        // Only a DRAFT revision, no EFFECTIVE revision at all.
        RevisionStatusDefinition draftRevStatus = revisionStatusRepository.findById("DRAFT").orElseThrow();
        newRevision(document, draftRevStatus, "0.0.1");

        DocumentLifecycleConflictException ex = assertThrows(DocumentLifecycleConflictException.class,
                () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest()));
        assertEquals("DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION", ex.getCode());

        DocumentRecord after = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("ACTIVE", after.getStatus().getCode(), "Document status must not change on rejection");
    }

    private void assertRevisionInProgressRejected(String prefix, String inProgressStatusCode) {
        DocumentRecord document = newActiveDocument(prefix);
        newRevision(document, effective, "1.0.0");
        RevisionStatusDefinition inProgressStatus = revisionStatusRepository.findById(inProgressStatusCode).orElseThrow();
        newRevision(document, inProgressStatus, "2.0.0");

        long auditRowsBefore = auditLogRepository.count();

        DocumentLifecycleConflictException ex = assertThrows(DocumentLifecycleConflictException.class,
                () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest()));
        assertEquals("DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS", ex.getCode());

        DocumentRecord after = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("ACTIVE", after.getStatus().getCode(), "Document status must not change on rejection");
        List<DocumentRevisionRecord> revisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId());
        assertTrue(revisions.stream().anyMatch(r -> inProgressStatusCode.equals(r.getStatus().getCode())),
                "The in-progress revision must remain untouched");
        assertEquals(auditRowsBefore, auditLogRepository.count(), "No audit entry may be created for a rejected attempt");
        assertTrue(electronicSignatureRepository.findByDocument_IdOrderBySignedAtAsc(document.getId()).isEmpty(),
                "No ElectronicSignature row may be created for a rejected attempt");
    }

    @Test
    void tcDoc028_revisionInProgress_draft_isRejected() {
        assertRevisionInProgressRejected("TCDOC028", "DRAFT");
    }

    @Test
    void tcDoc029_revisionInProgress_pendingReview_isRejected() {
        assertRevisionInProgressRejected("TCDOC029", "PENDING_REVIEW");
    }

    @Test
    void tcDoc030_revisionInProgress_pendingApproval_isRejected() {
        assertRevisionInProgressRejected("TCDOC030", "PENDING_APPROVAL");
    }

    @Test
    void tcDoc031_revisionInProgress_pendingTraining_isRejected() {
        assertRevisionInProgressRejected("TCDOC031", "PENDING_TRAINING");
    }

    @Test
    void tcDoc032_revisionInProgress_readyForPublishing_isRejected() {
        assertRevisionInProgressRejected("TCDOC032", "READY_FOR_PUBLISHING");
    }

    // ------------------------------------------------------------------
    // TC-DOC-037 through TC-DOC-042: Controlled Copy cascade, real persistence
    // ------------------------------------------------------------------

    @Test
    void tcDoc037through042_obsoleteCascadesControlledCopiesCorrectly() {
        DocumentRecord document = newActiveDocument("TCDOC037");
        DocumentRevisionRecord revision = newRevision(document, effective, "1.0.0");

        ControlledCopyRecord readyCopy = newControlledCopy(document, revision, "READY_FOR_DISTRIBUTION", 1);
        ControlledCopyRecord distributedCopy = newControlledCopy(document, revision, "DISTRIBUTED", 2);
        ControlledCopyRecord obsoletedCopy = newControlledCopy(document, revision, "OBSOLETED", 3);
        ControlledCopyRecord closedCancelledCopy = newControlledCopy(document, revision, "CLOSED_CANCELLED", 4);

        long auditRowsBefore = auditLogRepository.count();

        documentService.obsoleteDocument(document.getId(), obsoleteRequest());

        // TC-DOC-037/038: Ready-for-Distribution and Distributed copies transition to OBSOLETED.
        ControlledCopyRecord readyAfter = controlledCopyRepository.findById(readyCopy.getId()).orElseThrow();
        ControlledCopyRecord distributedAfter = controlledCopyRepository.findById(distributedCopy.getId()).orElseThrow();
        assertEquals("OBSOLETED", readyAfter.getStatusCode());
        assertEquals("OBSOLETED", distributedAfter.getStatusCode());

        // TC-DOC-039: terminal-state copies (already Obsoleted / Closed-Cancelled) are untouched.
        ControlledCopyRecord obsoletedAfter = controlledCopyRepository.findById(obsoletedCopy.getId()).orElseThrow();
        ControlledCopyRecord closedCancelledAfter = controlledCopyRepository.findById(closedCancelledCopy.getId()).orElseThrow();
        assertEquals("OBSOLETED", obsoletedAfter.getStatusCode());
        assertNull(obsoletedAfter.getObsoleteReason(), "A copy already Obsoleted before this run must not be re-stamped");
        assertEquals("CLOSED_CANCELLED", closedCancelledAfter.getStatusCode());
        assertNull(closedCancelledAfter.getObsoleteReason());

        // TC-DOC-040: cascaded copies carry the correct obsoleteReason.
        assertEquals("DOCUMENT_OBSOLETED", readyAfter.getObsoleteReason());
        assertEquals("DOCUMENT_OBSOLETED", distributedAfter.getObsoleteReason());

        // TC-DOC-041: audit entries exist at Document, Revision, and Controlled Copy levels.
        assertFalse(auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", document.getId()).isEmpty());
        assertFalse(auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("REVISION", revision.getId()).isEmpty());
        assertFalse(auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Controlled Copy", readyCopy.getId()).isEmpty());
        assertFalse(auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Controlled Copy", distributedCopy.getId()).isEmpty());
        assertTrue(auditLogRepository.count() > auditRowsBefore);

        // TC-DOC-042: since obsoleteDocument is one @Transactional method that has already returned
        // successfully here, all of the above committed together in a single transaction --
        // Document, Revision, and both cascaded Controlled Copies are consistently mutated.
        DocumentRecord documentAfter = documentRepository.findById(document.getId()).orElseThrow();
        DocumentRevisionRecord revisionAfter = revisionRepository.findById(revision.getId()).orElseThrow();
        assertEquals("OBSOLETED", documentAfter.getStatus().getCode());
        assertEquals("OBSOLETED", revisionAfter.getStatus().getCode());
    }

    // ------------------------------------------------------------------
    // TC-DOC-043, 045, 046, 047: canonical operation verification
    // ------------------------------------------------------------------

    @Test
    void tcDoc043_documentObsoletePath_invokesCanonicalOpWithDocumentObsoletedReason() {
        DocumentRecord document = newActiveDocument("TCDOC043");
        DocumentRevisionRecord revision = newRevision(document, effective, "1.0.0");
        ControlledCopyRecord copy = newControlledCopy(document, revision, "DISTRIBUTED", 1);

        documentService.obsoleteDocument(document.getId(), obsoleteRequest());

        ControlledCopyRecord after = controlledCopyRepository.findById(copy.getId()).orElseThrow();
        assertEquals(ControlledCopyLifecycleObsolescenceService.REASON_DOCUMENT_OBSOLETED, after.getObsoleteReason());
    }

    @Test
    void tcDoc044_revisionPublishSupersedePath_invokesCanonicalOpWithNewRevisionPublishedReason() {
        DocumentRecord document = newActiveDocument("TCDOC044");
        DocumentRevisionRecord oldRevision = newRevision(document, effective, "1.0.0");
        ControlledCopyRecord copy = newControlledCopy(document, oldRevision, "DISTRIBUTED", 1);

        RevisionStatusDefinition readyForPublishing = revisionStatusRepository.findById("READY_FOR_PUBLISHING").orElseThrow();
        DocumentRevisionRecord newRevision = newRevision(document, readyForPublishing, "1.0.1");

        RevisionWorkflowActionRequest request = new RevisionWorkflowActionRequest(
                "Publish for TC-DOC-044", null, tokenService.createSignatureToken(actor));
        revisionService.publishRevision(newRevision.getId(), request, actor);

        ControlledCopyRecord after = controlledCopyRepository.findById(copy.getId()).orElseThrow();
        assertEquals("OBSOLETED", after.getStatusCode());
        assertEquals(ControlledCopyLifecycleObsolescenceService.REASON_NEW_REVISION_PUBLISHED, after.getObsoleteReason());

        DocumentRevisionRecord oldRevisionAfter = revisionRepository.findById(oldRevision.getId()).orElseThrow();
        assertEquals("OBSOLETED", oldRevisionAfter.getStatus().getCode(), "Superseded revision must be obsoleted");
    }

    @Test
    void tcDoc045_canonicalOp_acceptsRevisionObsoletedReasonDirectly() {
        DocumentRecord document = newActiveDocument("TCDOC045");
        DocumentRevisionRecord revision = newRevision(document, effective, "1.0.0");
        ControlledCopyRecord copy = newControlledCopy(document, revision, "READY_FOR_DISTRIBUTION", 1);

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> controlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(
                revision, actor, Instant.now(),
                ControlledCopyLifecycleObsolescenceService.REASON_REVISION_OBSOLETED,
                "Direct canonical-operation contract test (TC-DOC-045)", null
        ));

        ControlledCopyRecord after = controlledCopyRepository.findById(copy.getId()).orElseThrow();
        assertEquals("OBSOLETED", after.getStatusCode());
        assertEquals("REVISION_OBSOLETED", after.getObsoleteReason());

        List<AuditLog> auditRows = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Controlled Copy", copy.getId());
        assertFalse(auditRows.isEmpty());
        assertTrue(auditRows.stream().anyMatch(a -> "Direct canonical-operation contract test (TC-DOC-045)".equals(a.getReason())),
                "The reason code path must preserve the audit comment/reason on the resulting entry");
    }

    @Test
    void tcDoc046_retiredDuplicateImplementation_noLongerExistsOnRevisionService() {
        boolean stillHasIndependentMutator = java.util.Arrays.stream(RevisionService.class.getDeclaredMethods())
                .anyMatch(m -> m.getName().equals("obsoleteDistributedControlledCopies"));
        assertFalse(stillHasIndependentMutator,
                "The retired AS-IS duplicate (obsoleteDistributedControlledCopies) must no longer exist as an "
                        + "independent mutator on RevisionService -- both callers must go through the canonical "
                        + "ControlledCopyLifecycleObsolescenceService instead");
    }

    @Test
    void tcDoc047_bothCallersProduceIdenticalAuditEntryShape() {
        // Caller 1: Document Obsolete.
        DocumentRecord document1 = newActiveDocument("TCDOC047A");
        DocumentRevisionRecord revision1 = newRevision(document1, effective, "1.0.0");
        ControlledCopyRecord copy1 = newControlledCopy(document1, revision1, "DISTRIBUTED", 1);
        documentService.obsoleteDocument(document1.getId(), obsoleteRequest());
        AuditLog auditFromDocumentObsolete = auditLogRepository
                .findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Controlled Copy", copy1.getId())
                .stream().findFirst().orElseThrow();

        // Caller 2: Revision publish-supersede.
        DocumentRecord document2 = newActiveDocument("TCDOC047B");
        DocumentRevisionRecord oldRevision2 = newRevision(document2, effective, "1.0.0");
        ControlledCopyRecord copy2 = newControlledCopy(document2, oldRevision2, "DISTRIBUTED", 1);
        RevisionStatusDefinition readyForPublishing = revisionStatusRepository.findById("READY_FOR_PUBLISHING").orElseThrow();
        DocumentRevisionRecord newRevision2 = newRevision(document2, readyForPublishing, "1.0.1");
        revisionService.publishRevision(newRevision2.getId(),
                new RevisionWorkflowActionRequest("Publish for TC-DOC-047", null, tokenService.createSignatureToken(actor)),
                actor);
        AuditLog auditFromPublishSupersede = auditLogRepository
                .findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Controlled Copy", copy2.getId())
                .stream().findFirst().orElseThrow();

        assertEquals(auditFromDocumentObsolete.getEntityType(), auditFromPublishSupersede.getEntityType());
        assertEquals(auditFromDocumentObsolete.getActionType(), auditFromPublishSupersede.getActionType());
        assertEquals(auditFromDocumentObsolete.getToStatus(), auditFromPublishSupersede.getToStatus());
        assertNotEquals(
                "Both callers must produce the same shape but differ only in reason code",
                auditFromDocumentObsolete.getReason(), auditFromPublishSupersede.getReason());
    }

    // ------------------------------------------------------------------
    // TC-DOC-048, 049, 050: CRITICAL atomicity -- forced failure mid-cascade
    // ------------------------------------------------------------------

    @Test
    void tcDoc048_049_050_forcedFailureMidCascade_rollsBackEverything() {
        DocumentRecord document = newActiveDocument("TCDOC048");
        DocumentRevisionRecord revision = newRevision(document, effective, "1.0.0");
        ControlledCopyRecord firstCopy = newControlledCopy(document, revision, "READY_FOR_DISTRIBUTION", 1);
        ControlledCopyRecord secondCopy = newControlledCopy(document, revision, "DISTRIBUTED", 2);

        long auditRowsBefore = auditLogRepository.count();
        long signatureRowsBefore = electronicSignatureRepository.findByDocument_IdOrderBySignedAtAsc(document.getId()).size();

        // Inject the failure at the LAST Controlled-Copy audit call -- by that point the Revision
        // cascade has fully completed and the first Controlled Copy's mutation+audit has already
        // run (within this same, still-uncommitted transaction), matching "after the Revision
        // cascade completes but before the Controlled-Copy cascade finishes." No production
        // business logic is altered; this reuses the same @SpyBean AuditTrailService seam as
        // TC-DOC-009.
        doThrow(new RuntimeException("TC-DOC-048 injected failure: simulated mid-cascade, pre-commit failure"))
                .when(auditTrailService)
                .logAs(any(), eq("Controlled Copy"), any(), eq(secondCopy.getId()), eq("OBSOLETE"), any(), any(), any(), any(), any());

        assertThrows(RuntimeException.class, () -> documentService.obsoleteDocument(document.getId(), obsoleteRequest()));

        // TC-DOC-048: full rollback of Document, Revision, and both Controlled Copy statuses.
        DocumentRecord documentAfter = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals("ACTIVE", documentAfter.getStatus().getCode(), "Document must remain ACTIVE");
        assertNull(documentAfter.getObsoletedAt(), "Document obsoletedAt must not persist");

        DocumentRevisionRecord revisionAfter = revisionRepository.findById(revision.getId()).orElseThrow();
        assertEquals("EFFECTIVE", revisionAfter.getStatus().getCode(), "Revision must remain EFFECTIVE");

        ControlledCopyRecord firstCopyAfter = controlledCopyRepository.findById(firstCopy.getId()).orElseThrow();
        ControlledCopyRecord secondCopyAfter = controlledCopyRepository.findById(secondCopy.getId()).orElseThrow();
        assertEquals("READY_FOR_DISTRIBUTION", firstCopyAfter.getStatusCode(), "First copy's mutation must roll back too");
        assertEquals("DISTRIBUTED", secondCopyAfter.getStatusCode());
        assertNull(firstCopyAfter.getObsoleteReason());
        assertNull(secondCopyAfter.getObsoleteReason());

        // TC-DOC-049: no orphan audit rows from the failed attempt, at any level.
        assertEquals(auditRowsBefore, auditLogRepository.count(),
                "No Document/Revision/Controlled-Copy audit row from the failed attempt may persist");

        // TC-DOC-050: no orphan ElectronicSignature row from the failed attempt.
        long signatureRowsAfter = electronicSignatureRepository.findByDocument_IdOrderBySignedAtAsc(document.getId()).size();
        assertEquals(signatureRowsBefore, signatureRowsAfter, "No ElectronicSignature row from the failed attempt may persist");
    }
}
