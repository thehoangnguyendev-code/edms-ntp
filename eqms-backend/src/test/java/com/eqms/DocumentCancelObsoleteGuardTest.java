package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.exception.FileAccessDeniedException;
import com.eqms.exception.DocumentLifecycleConflictException;
import org.springframework.context.ApplicationEventPublisher;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.service.authorization.AuthorizationCutoverFlags;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for the Cancel Document Master guard added to close the orphaned-Revision
 * gap: cancelDocument() must reject the request once any Revision exists for the Document, instead
 * of only relying on the FE to hide the button.
 */
@ExtendWith(MockitoExtension.class)
public class DocumentCancelObsoleteGuardTest {

    @Mock private DocumentRecordRepository documentRepository;
    @Mock private DocumentStatusDefinitionRepository statusRepository;
    @Mock private DocumentTypeRepository documentTypeRepository;
    @Mock private DocumentSubTypeRepository documentSubTypeRepository;
    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentRelationRepository documentRelationRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    @Mock private AuditTrailService auditTrailService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private CurrentUserService currentUserService;
    @Mock private TokenService tokenService;
    @Mock private RevisionStatusDefinitionRepository revisionStatusRepository;
    @Mock private RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private RevisionPublishingMetadataRepository publishingMetadataRepository;
    @Mock private ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private AuthorizationShadowEvaluationService shadowEvaluationService;
    @Mock private AuthorizationEngineService authorizationEngineService;
    @Mock private AuthorizationCutoverFlags cutoverFlags;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private RevisionService revisionService;
    @Mock private WorkflowParticipantEligibilityService workflowParticipantEligibilityService;
    @Mock private SecureFileAccessService secureFileAccessService;
    @Mock private SignatureTokenConsumptionService signatureTokenConsumptionService;
    @Mock private ControlledCopyLifecycleObsolescenceService controlledCopyLifecycleObsolescenceService;
    @Mock private ApplicationEventPublisher applicationEventPublisher;

    @InjectMocks
    private DocumentService documentService;

    private UUID documentId;
    private UserAccount currentUser;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        documentId = UUID.randomUUID();
        currentUser = new UserAccount();
        currentUser.setId(UUID.randomUUID());

        document = new DocumentRecord();
        document.setId(documentId);
        document.setDocumentNumber("SOP-0001");
        document.setDocumentName("Test Document");
        DocumentStatusDefinition draft = new DocumentStatusDefinition();
        draft.setCode("DRAFT");
        document.setStatus(draft);

        org.mockito.Mockito.lenient().when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        org.mockito.Mockito.lenient().when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        org.mockito.Mockito.lenient().doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(currentUser, document, "CANCEL");

        // controlledCopyLifecycleObsolescenceService/applicationEventPublisher are @Autowired
        // field-injected (not constructor params) on DocumentService, so @InjectMocks does not
        // reliably wire them here -- set explicitly.
        org.springframework.test.util.ReflectionTestUtils.setField(
                documentService, "controlledCopyLifecycleObsolescenceService", controlledCopyLifecycleObsolescenceService);
        org.springframework.test.util.ReflectionTestUtils.setField(
                documentService, "applicationEventPublisher", applicationEventPublisher);
    }

    @Test
    void cancelDocument_withExistingRevision_isRejected() {
        when(documentRevisionRepository.existsByDocument_Id(documentId)).thenReturn(true);

        // TBR-DOC-008: the existing-Revision Cancel conflict is now a recoverable business-state
        // conflict (HTTP 409, code DOCUMENT_CANCEL_NOT_ALLOWED), never a generic IllegalStateException.
        DocumentLifecycleConflictException ex = assertThrows(
                DocumentLifecycleConflictException.class,
                () -> documentService.cancelDocument(documentId, null)
        );
        org.junit.jupiter.api.Assertions.assertEquals("DOCUMENT_CANCEL_NOT_ALLOWED", ex.getCode());

        verify(documentRepository, never()).save(document);
        verify(auditTrailService, never()).logAs(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void obsoleteDocument_delegatesControlledCopyCascadeToCanonicalOperation() {
        // TBR-DOC-013/014: DocumentService no longer mutates Controlled Copies inline -- it
        // delegates to the canonical ControlledCopyLifecycleObsolescenceService (the same operation
        // RevisionService's publish-supersede cascade uses), passing reason DOCUMENT_OBSOLETED.
        DocumentStatusDefinition active = new DocumentStatusDefinition();
        active.setCode("ACTIVE");
        document.setStatus(active);
        RevisionStatusDefinition effective = new RevisionStatusDefinition();
        effective.setCode("EFFECTIVE");
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        revision.setStatus(effective);

        DocumentStatusDefinition obsoleted = new DocumentStatusDefinition();
        obsoleted.setCode("OBSOLETED");
        RevisionStatusDefinition obsoletedRevision = new RevisionStatusDefinition();
        obsoletedRevision.setCode("OBSOLETED");
        when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE"))
                .thenReturn(Optional.of(revision));
        when(documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(eq(documentId), anyList())).thenReturn(false);
        when(statusRepository.findById("OBSOLETED")).thenReturn(Optional.of(obsoleted));
        when(revisionStatusRepository.findById("OBSOLETED")).thenReturn(Optional.of(obsoletedRevision));
        when(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId)).thenReturn(List.of(revision));
        UUID signatureSessionId = UUID.randomUUID();
        when(signatureTokenConsumptionService.requireAndConsume("signature-token", currentUser)).thenReturn(signatureSessionId);
        org.mockito.Mockito.doNothing().when(documentAuthorizationService)
                .requireDocumentMasterLifecycleAction(currentUser, document, "OBSOLETE");

        documentService.obsoleteDocument(documentId, new com.eqms.dto.document.DocumentObsoleteRequest("obsolete", null, "signature-token"));

        verify(controlledCopyLifecycleObsolescenceService).obsoleteControlledCopiesForRevision(
                eq(revision),
                eq(currentUser),
                any(),
                eq(ControlledCopyLifecycleObsolescenceService.REASON_DOCUMENT_OBSOLETED),
                contains("DOCUMENT_OBSOLETED"),
                eq(signatureSessionId)
        );
        // The Revision itself is already OBSOLETED/CLOSED_CANCELLED-checked before delegating; this
        // Revision is EFFECTIVE (non-terminal), so the Revision cascade must also have run.
        verify(revisionService).obsoleteRevisionAsPartOfDocumentObsolete(
                eq(revision), eq(obsoletedRevision), eq(currentUser), any(), eq(signatureSessionId)
        );
        // TBR-DOC-016: the after-commit notification event is queued (not dispatched synchronously
        // here -- that is the listener's job, verified separately).
        verify(applicationEventPublisher).publishEvent(any(com.eqms.event.DocumentObsoletedEvent.class));
    }

    // TC-DOC-033/070/071: electronic-signature negative paths for Obsolete. For every case:
    // Document remains ACTIVE, no cascade/audit/signature mutation occurs.

    @Test
    void obsoleteDocument_missingSignatureToken_isRejected() {
        DocumentStatusDefinition active = new DocumentStatusDefinition();
        active.setCode("ACTIVE");
        document.setStatus(active);

        assertThrows(
                IllegalArgumentException.class,
                () -> documentService.obsoleteDocument(
                        documentId, new com.eqms.dto.document.DocumentObsoleteRequest("obsolete", null, null))
        );

        assertEquals("ACTIVE", document.getStatus().getCode());
        verify(documentRepository, never()).save(document);
        verify(electronicSignatureService, never()).createEntitySignature(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(auditTrailService, never()).logAs(
                any(), any(), any(), any(), eq("OBSOLETE"), any(), any(), any(), anyList(), any());
    }

    @Test
    void obsoleteDocument_expiredOrInvalidSignatureToken_isRejected() {
        DocumentStatusDefinition active = new DocumentStatusDefinition();
        active.setCode("ACTIVE");
        document.setStatus(active);
        when(signatureTokenConsumptionService.requireAndConsume("expired-token", currentUser))
                .thenThrow(new UnauthorizedException("Electronic signature is invalid or expired"));

        assertThrows(
                UnauthorizedException.class,
                () -> documentService.obsoleteDocument(
                        documentId, new com.eqms.dto.document.DocumentObsoleteRequest("obsolete", null, "expired-token"))
        );

        assertEquals("ACTIVE", document.getStatus().getCode());
        verify(documentRepository, never()).save(document);
        verify(electronicSignatureService, never()).createEntitySignature(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void obsoleteDocument_consumedReplayedSignatureToken_isRejected() {
        DocumentStatusDefinition active = new DocumentStatusDefinition();
        active.setCode("ACTIVE");
        document.setStatus(active);
        when(signatureTokenConsumptionService.requireAndConsume("replayed-token", currentUser))
                .thenThrow(new UnauthorizedException("This electronic signature has already been used and cannot be reused"));

        assertThrows(
                UnauthorizedException.class,
                () -> documentService.obsoleteDocument(
                        documentId, new com.eqms.dto.document.DocumentObsoleteRequest("obsolete", null, "replayed-token"))
        );

        assertEquals("ACTIVE", document.getStatus().getCode());
        verify(documentRepository, never()).save(document);
        verify(electronicSignatureService, never()).createEntitySignature(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    /**
     * DC-XF-39: previewDocumentFile() must not silently fall back to serving a Draft revision's
     * source just because no EFFECTIVE revision exists yet. Reproduces the exact fallback path
     * (resolveActiveRevision() returning the only, Draft, revision) and asserts the dedicated
     * SecureFileAccessService rejects it -- the PUBLISHED_PDF business rule only allows
     * EFFECTIVE/OBSOLETED.
     */
    @Test
    void previewDocumentFile_fallsBackToOnlyDraftRevision_isBlockedBySecureFileAccessService() {
        DocumentRevisionRecord draftRevision = new DocumentRevisionRecord();
        draftRevision.setId(UUID.randomUUID());
        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");
        draftRevision.setStatus(draftStatus);

        when(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId))
                .thenReturn(List.of(draftRevision));

        doThrow(new FileAccessDeniedException(
                "INVALID_REVISION_STATUS", "Published PDF is only available for effective or obsoleted revisions.",
                "documents.document.preview_published", FileAccessAction.VIEW_PREVIEW, FileObjectType.PUBLISHED_PDF, draftRevision.getId()))
                .when(secureFileAccessService).require(
                        eq(currentUser), eq(FileAccessAction.VIEW_PREVIEW), eq(FileObjectType.PUBLISHED_PDF),
                        eq(draftRevision.getId()), any());

        assertThrows(FileAccessDeniedException.class, () -> documentService.previewDocumentFile(documentId));

        verify(auditTrailService, never()).logAs(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq("PREVIEW"), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
