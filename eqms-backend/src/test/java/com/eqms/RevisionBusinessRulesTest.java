package com.eqms;

import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.auth.*;
import com.eqms.exception.RelatedDocumentsNotEffectiveException;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.exception.WorkflowAuthorizationDeniedException;
import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RevisionBusinessRulesTest {

    @Mock private DocumentRevisionRepository revisionRepository;
    @Mock private DocumentRecordRepository documentRepository;
    @Mock private jakarta.persistence.EntityManager entityManager;
    @Mock private RevisionStatusDefinitionRepository revisionStatusRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    @Mock private TokenService tokenService;
    @Mock private RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository;
    @Mock private AuditTrailService auditTrailService;
    @Mock private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Mock private DocumentRelationRepository documentRelationRepository;
    @Mock private DocumentStatusDefinitionRepository documentStatusRepository;
    @Mock private RevisionWorkingNoteRepository revisionWorkingNoteRepository;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private TrainingAuthorizationService trainingAuthorizationService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private FileStorageService fileStorageService;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private RevisionPublishingMetadataRepository publishingMetadataRepository;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private PublishingPdfComposerService publishingPdfComposerService;
    @Mock private ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    @Mock private NotificationRealtimeService notificationRealtimeService;
    @Mock private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    @Mock private SecureFileAccessService secureFileAccessService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private WorkflowParticipantEligibilityService workflowParticipantEligibilityService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private SignatureTokenConsumptionService signatureTokenConsumptionService;

    @InjectMocks
    private RevisionService revisionService;

    private UserAccount currentUser;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        // @Autowired field-injected members (not constructor params) are not reliably wired by
        // @InjectMocks -- set explicitly, matching the pattern already used elsewhere.
        ReflectionTestUtils.setField(revisionService, "entityManager", entityManager);

        currentUser = new UserAccount();
        currentUser.setId(UUID.randomUUID());
        currentUser.setUsername("testuser");

        document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDocumentName("Test Document");
        DocumentStatusDefinition ds = new DocumentStatusDefinition();
        ds.setCode("DRAFT");
        document.setStatus(ds);

        lenient().when(revisionWorkflowAuthorizationService.check(
                any(UserAccount.class), any(DocumentRevisionRecord.class), any(), any()))
                .thenAnswer(invocation -> WorkflowAuthorizationDecision.allowed(
                        invocation.getArgument(2),
                        invocation.getArgument(1, DocumentRevisionRecord.class).getId(),
                        "DRAFT", false, false));
        lenient().when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(
                new TokenService.ParsedAccessToken(
                        "signature",
                        new AuthenticatedUser(currentUser.getId(), UUID.randomUUID(), currentUser.getUsername(), "USER", java.util.Collections.emptySet())
                )
        ));
        lenient().when(signatureTokenConsumptionService.requireAndConsume(anyString(), any(UserAccount.class)))
                .thenReturn(UUID.randomUUID());
        // #13: copyWorkflowParticipantsFromDocument/Revision now re-validate SoD, which reads this
        // -- default to an all-rules-off setting so tests that don't care about SoD (most of this
        // file) aren't newly required to stub it just to reach unrelated assertions.
        lenient().when(documentWorkflowSettingRepository.findFirstByOrderByIdAsc())
                .thenReturn(Optional.of(new DocumentWorkflowSetting()));
    }

    @Test
    void uploadRevisionFile_deniesDirectApiCallAfterEditingAlreadyCompleted() {
        // Regression for the gap where completeEditing() locks the source (editingStatus
        // "COMPLETED", sourceLocked=true) while status stays "DRAFT" -- requireRevisionStatus(...,
        // "DRAFT") alone does not catch this. A direct POST /revisions/{id}/upload call (bypassing
        // the FE hint that already hides the button via canUploadRevisionSource) must still be
        // rejected server-side.
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition draft = new RevisionStatusDefinition();
        draft.setCode("DRAFT");
        revision.setStatus(draft);
        revision.setEditingStatus("COMPLETED");
        revision.setSourceLocked(true);

        DocumentStatusDefinition activeStatus = new DocumentStatusDefinition();
        activeStatus.setCode("ACTIVE");
        document.setStatus(activeStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        doNothing().when(documentAuthorizationService).requireCanUploadRevision(currentUser, document);

        org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                "file", "revision.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "content".getBytes());

        RevisionLifecycleConflictException ex = assertThrows(RevisionLifecycleConflictException.class,
                () -> revisionService.uploadRevisionFile(revisionId, file));
        assertEquals("REVISION_EDITING_ALREADY_COMPLETED", ex.getCode());

        assertEquals("DRAFT", revision.getStatus().getCode());
        verify(revisionRepository, never()).save(any());
    }

    @Test
    void completeApproval_deniesDirectApiCallWhenWorkflowPolicyDenies() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition pendingApproval = new RevisionStatusDefinition();
        pendingApproval.setCode("PENDING_APPROVAL");
        revision.setStatus(pendingApproval);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        doThrow(new WorkflowAuthorizationDeniedException("MISSING_PERMISSION", "denied"))
                .when(revisionWorkflowAuthorizationService)
                .require(eq(currentUser), eq(revision), eq(com.eqms.enums.RevisionWorkflowAction.COMPLETE_APPROVAL), any());

        assertThrows(WorkflowAuthorizationDeniedException.class,
                () -> revisionService.completeApproval(revisionId,
                        new RevisionWorkflowActionRequest("approval", "approval", "token")));

        verify(revisionWorkflowAuthorizationService).require(
                eq(currentUser), eq(revision), eq(com.eqms.enums.RevisionWorkflowAction.COMPLETE_APPROVAL), any());
        verify(revisionWorkflowParticipantRepository, never()).save(any());
        verify(revisionRepository, never()).save(revision);
    }

    @Test
    public void createRevision_shouldUseNextNumberAfterCancelledRevisions() throws Exception {
        // Mock existing revisions: 0.0.1 Cancelled, 0.0.2 Cancelled, 0.0.3 Cancelled
        DocumentRevisionRecord r1 = new DocumentRevisionRecord(); r1.setRevisionNumber("0.0.1"); r1.setCreatedAt(Instant.now());
        DocumentRevisionRecord r2 = new DocumentRevisionRecord(); r2.setRevisionNumber("0.0.2"); r2.setCreatedAt(Instant.now());
        DocumentRevisionRecord r3 = new DocumentRevisionRecord(); r3.setRevisionNumber("0.0.3"); r3.setCreatedAt(Instant.now());
        
        when(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()))
                .thenReturn(Arrays.asList(r3, r2, r1));

        // Use Reflection to invoke private method resolveNextDraftRevisionNumber
        String nextVersion = ReflectionTestUtils.invokeMethod(revisionService, "resolveNextDraftRevisionNumber", document.getId());
        assertEquals("0.0.4", nextVersion);
    }

    // TBR-DOC-014: this behavior now lives in the canonical
    // ControlledCopyLifecycleObsolescenceService (shared with DocumentService.obsoleteDocument),
    // not in a RevisionService-private method -- test the canonical operation directly rather
    // than reflectively invoking a method that no longer exists on RevisionService.
    @Test
    void obsoleteRevision_invalidatesReadyControlledCopyWithoutOverwritingCancelledCopy() {
        DocumentRevisionRecord sourceRevision = new DocumentRevisionRecord();
        sourceRevision.setId(UUID.randomUUID());
        ControlledCopyRecord readyCopy = new ControlledCopyRecord();
        readyCopy.setId(UUID.randomUUID());
        readyCopy.setControlledCopyNumber("CC-READY-001");
        readyCopy.setStatusCode("READY_FOR_DISTRIBUTION");
        readyCopy.setCurrentStage("Ready for Distribution");
        ControlledCopyRecord cancelledCopy = new ControlledCopyRecord();
        cancelledCopy.setId(UUID.randomUUID());
        cancelledCopy.setControlledCopyNumber("CC-CANCELLED-001");
        cancelledCopy.setStatusCode("CLOSED_CANCELLED");
        cancelledCopy.setCurrentStage("Closed - Cancelled");
        Instant obsoletedAt = Instant.now();
        UUID signatureSessionId = UUID.randomUUID();
        when(controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(sourceRevision.getId()))
                .thenReturn(List.of(readyCopy, cancelledCopy));

        com.eqms.service.ControlledCopyLifecycleObsolescenceService canonicalService =
                new com.eqms.service.ControlledCopyLifecycleObsolescenceService(
                        controlledCopyRepository, auditTrailService, controlledCopyBatchStatusService);
        org.springframework.test.util.ReflectionTestUtils.setField(
                canonicalService, "controlledCopyService", org.mockito.Mockito.mock(com.eqms.service.ControlledCopyService.class));

        canonicalService.obsoleteControlledCopiesForRevision(
                sourceRevision,
                currentUser,
                obsoletedAt,
                com.eqms.service.ControlledCopyLifecycleObsolescenceService.REASON_REVISION_OBSOLETED,
                "Parent revision obsoleted",
                signatureSessionId
        );

        assertEquals("OBSOLETED", readyCopy.getStatusCode());
        assertEquals("REVISION_OBSOLETED", readyCopy.getObsoleteReason());
        assertEquals("CLOSED_CANCELLED", cancelledCopy.getStatusCode());
        verify(controlledCopyRepository).save(readyCopy);
        verify(controlledCopyRepository, never()).save(cancelledCopy);
        verify(auditTrailService).logAs(
                eq(currentUser), eq("Controlled Copy"), eq("CC-READY-001"), eq(readyCopy.getId()),
                eq("OBSOLETE"), eq("READY_FOR_DISTRIBUTION"), eq("Obsoleted"),
                eq("Parent revision obsoleted"), eq(List.of()), eq(signatureSessionId)
        );
        verify(controlledCopyBatchStatusService).synchronize(List.of(readyCopy, cancelledCopy));
    }

    @Test
    public void cancelDraft_shouldKeepRevisionNumber() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("0.0.1");
        revision.setDocument(document);
        
        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");
        revision.setStatus(draftStatus);

        DocumentRevisionRecord effectiveRevision = new DocumentRevisionRecord();
        effectiveRevision.setId(UUID.randomUUID());
        effectiveRevision.setDocument(document);
        RevisionStatusDefinition effectiveStatus = new RevisionStatusDefinition();
        effectiveStatus.setCode("EFFECTIVE");
        effectiveRevision.setStatus(effectiveStatus);

        RevisionStatusDefinition cancelledStatus = new RevisionStatusDefinition();
        cancelledStatus.setCode("CLOSED_CANCELLED");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(revisionRepository.existsByDocument_IdAndStatus_CodeInAndIdNot(eq(document.getId()), anyList(), eq(revisionId)))
                .thenReturn(true);
        when(revisionStatusRepository.findById("CLOSED_CANCELLED")).thenReturn(Optional.of(cancelledStatus));

        revisionService.cancelRevision(revisionId, new RevisionWorkflowActionRequest("cancel reason", "comment", "token"));

        assertEquals("0.0.1", revision.getRevisionNumber());
        assertEquals("CLOSED_CANCELLED", revision.getStatus().getCode());
        verify(revisionRepository).save(revision);
        verify(documentRepository, never()).save(any());
    }

    @Test
    public void cancelPendingApproval_shouldBeRejected_cancelIsDraftOnly() {
        // Product decision: cancel is now Draft-only, matching the REVISION/CANCEL
        // workflow_action_policy state invariant already used by the FE capability. A revision
        // already in review/approval/training/ready-for-publishing must not be cancellable via
        // this action.
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("1.0.1");
        revision.setDocument(document);

        RevisionStatusDefinition pendingApprovalStatus = new RevisionStatusDefinition();
        pendingApprovalStatus.setCode("PENDING_APPROVAL");
        revision.setStatus(pendingApprovalStatus);

        DocumentStatusDefinition activeStatus = new DocumentStatusDefinition();
        activeStatus.setCode("ACTIVE");
        document.setStatus(activeStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));

        assertThrows(RevisionLifecycleConflictException.class, () -> revisionService.cancelRevision(
                revisionId,
                new RevisionWorkflowActionRequest("Cancel pending approval", "Cancel pending approval", "token")
        ));

        assertEquals("PENDING_APPROVAL", revision.getStatus().getCode());
        verify(revisionRepository, never()).save(any());
        verify(documentRepository, never()).save(any());
    }

    @Test
    public void cancelLastRevision_shouldCloseDocument() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("0.0.1");
        revision.setDocument(document);

        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");
        revision.setStatus(draftStatus);

        DocumentStatusDefinition activeStatus = new DocumentStatusDefinition();
        activeStatus.setCode("ACTIVE");
        document.setStatus(activeStatus);

        RevisionStatusDefinition cancelledStatus = new RevisionStatusDefinition();
        cancelledStatus.setCode("CLOSED_CANCELLED");
        DocumentStatusDefinition closedCancelledStatus = new DocumentStatusDefinition();
        closedCancelledStatus.setCode("CLOSED_CANCELLED");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(revisionRepository.existsByDocument_IdAndStatus_CodeInAndIdNot(eq(document.getId()), anyList(), eq(revisionId)))
                .thenReturn(false);
        when(revisionStatusRepository.findById("CLOSED_CANCELLED")).thenReturn(Optional.of(cancelledStatus));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(documentStatusRepository.findById("CLOSED_CANCELLED")).thenReturn(Optional.of(closedCancelledStatus));
        UUID signatureSessionId = UUID.randomUUID();
        when(signatureTokenConsumptionService.requireAndConsume("token", currentUser)).thenReturn(signatureSessionId);

        revisionService.cancelRevision(
                revisionId,
                new RevisionWorkflowActionRequest("Cancel final revision", "Cancel final revision", "token")
        );

        assertEquals("CLOSED_CANCELLED", revision.getStatus().getCode());
        assertEquals("CLOSED_CANCELLED", document.getStatus().getCode());
        verify(revisionRepository).save(revision);
        verify(documentRepository).save(document);
        verify(auditTrailService).logAs(
                eq(currentUser), eq("DOCUMENT"), any(), eq(document.getId()), eq("CANCEL"),
                eq("ACTIVE"), eq("CLOSED_CANCELLED"), contains("automatically closed"),
                anyList(), eq(signatureSessionId)
        );
    }

    @Test
    public void rejectReview_shouldNotIncrementRevisionNumber() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("0.0.1");
        revision.setDocument(document);
        
        RevisionStatusDefinition pendingReviewStatus = new RevisionStatusDefinition();
        pendingReviewStatus.setCode("PENDING_REVIEW");
        revision.setStatus(pendingReviewStatus);

        RevisionWorkflowParticipant participant = new RevisionWorkflowParticipant();
        participant.setParticipantType("REVIEWER");
        participant.setUser(currentUser);
        participant.setActionStatus("PENDING");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(revisionWorkflowParticipantRepository.findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, "REVIEWER", currentUser.getId()))
                .thenReturn(Optional.of(participant));
        
        // Mock tokenService for token validation
        AuthenticatedUser authUser = new AuthenticatedUser(currentUser.getId(), UUID.randomUUID(), "testuser", "USER", java.util.Collections.emptySet());
        TokenService.ParsedAccessToken parsedToken = new TokenService.ParsedAccessToken("signature", authUser);
        when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(parsedToken));

        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");
        when(revisionStatusRepository.findById("DRAFT")).thenReturn(Optional.of(draftStatus));

        revisionService.rejectReview(revisionId, new RevisionWorkflowActionRequest("reject reason", "comment", "valid_token"));

        assertEquals("0.0.1", revision.getRevisionNumber());
        assertEquals("DRAFT", revision.getStatus().getCode());
        assertNotNull(revision.getRejectedAt());
        verify(revisionRepository, atLeastOnce()).save(revision);
    }

    @Test
    public void rejectReview_shouldRequireActivitySummary_whenReasonAndCommentBlank() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition pendingReviewStatus = new RevisionStatusDefinition();
        pendingReviewStatus.setCode("PENDING_REVIEW");
        revision.setStatus(pendingReviewStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));

        assertThrows(IllegalArgumentException.class, () -> revisionService.rejectReview(
                revisionId, new RevisionWorkflowActionRequest(null, null, "valid_token")));

        verify(revisionRepository, never()).save(any());
    }

    @Test
    public void rejectApproval_shouldRequireActivitySummary_whenReasonAndCommentBlank() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition pendingApprovalStatus = new RevisionStatusDefinition();
        pendingApprovalStatus.setCode("PENDING_APPROVAL");
        revision.setStatus(pendingApprovalStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));

        assertThrows(IllegalArgumentException.class, () -> revisionService.rejectApproval(
                revisionId, new RevisionWorkflowActionRequest(null, null, "valid_token")));

        verify(revisionRepository, never()).save(any());
    }

    @Test
    public void rejectApproval_shouldSendNotification_toWorkflowCoordinators() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("0.0.1");
        revision.setDocument(document);

        RevisionStatusDefinition pendingApprovalStatus = new RevisionStatusDefinition();
        pendingApprovalStatus.setCode("PENDING_APPROVAL");
        revision.setStatus(pendingApprovalStatus);

        RevisionWorkflowParticipant participant = new RevisionWorkflowParticipant();
        participant.setParticipantType("APPROVER");
        participant.setUser(currentUser);
        participant.setActionStatus("PENDING");

        UserAccount coordinator = new UserAccount();
        coordinator.setId(UUID.randomUUID());
        coordinator.setUsername("coordinator");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(revisionWorkflowParticipantRepository.findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, "APPROVER", currentUser.getId()))
                .thenReturn(Optional.of(participant));
        when(userAccountRepository.findAllByStatus(UserStatus.Active)).thenReturn(List.of(coordinator));
        when(permissionEvaluationService.hasPermission(coordinator, "documents.workspace.manage")).thenReturn(true);

        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");
        when(revisionStatusRepository.findById("DRAFT")).thenReturn(Optional.of(draftStatus));

        revisionService.rejectApproval(revisionId, new RevisionWorkflowActionRequest("reject reason", "comment", "valid_token"));

        verify(emailNotificationService).sendDocumentWorkflowNotification(eq("document-approval-rejected"), anyCollection(), anyMap());
    }

    @Test
    public void rejectReview_shouldThrowRevisionLifecycleConflict_whenRevisionNotInPendingReview() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");
        revision.setStatus(draftStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));

        assertThrows(RevisionLifecycleConflictException.class, () -> revisionService.rejectReview(
                revisionId, new RevisionWorkflowActionRequest("reject reason", "comment", "valid_token")));

        verify(revisionRepository, never()).save(any());
    }

    @Test
    public void rejectReview_shouldThrowRevisionLifecycleConflict_whenParticipantAlreadyActed() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition pendingReviewStatus = new RevisionStatusDefinition();
        pendingReviewStatus.setCode("PENDING_REVIEW");
        revision.setStatus(pendingReviewStatus);

        RevisionWorkflowParticipant participant = new RevisionWorkflowParticipant();
        participant.setParticipantType("REVIEWER");
        participant.setUser(currentUser);
        participant.setActionStatus("REJECTED");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(revisionWorkflowParticipantRepository.findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, "REVIEWER", currentUser.getId()))
                .thenReturn(Optional.of(participant));

        assertThrows(RevisionLifecycleConflictException.class, () -> revisionService.rejectReview(
                revisionId, new RevisionWorkflowActionRequest("reject reason", "comment", "valid_token")));

        verify(revisionRepository, never()).save(any());
    }

    @Test
    public void upgradeFromEffective_shouldCreateNextDraftIteration() {
        DocumentRevisionRecord effectiveRevision = new DocumentRevisionRecord();
        effectiveRevision.setRevisionNumber("1.0.0");
        effectiveRevision.setCreatedAt(Instant.now());
        
        when(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()))
                .thenReturn(List.of(effectiveRevision));

        String nextVersion = ReflectionTestUtils.invokeMethod(revisionService, "resolveNextDraftRevisionNumber", document.getId());
        assertEquals("1.0.1", nextVersion);
    }

    @Test
    public void upgradeAfterCancelledDraft_shouldIncrementLastNumber() {
        DocumentRevisionRecord effectiveRevision = new DocumentRevisionRecord();
        effectiveRevision.setRevisionNumber("1.0.0");
        effectiveRevision.setCreatedAt(Instant.now());
        
        DocumentRevisionRecord cancelledDraft = new DocumentRevisionRecord();
        cancelledDraft.setRevisionNumber("1.0.1");
        cancelledDraft.setCreatedAt(Instant.now());

        when(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()))
                .thenReturn(Arrays.asList(cancelledDraft, effectiveRevision));

        String nextVersion = ReflectionTestUtils.invokeMethod(revisionService, "resolveNextDraftRevisionNumber", document.getId());
        assertEquals("1.0.2", nextVersion);
    }

    @Test
    public void createRevision_shouldFailWhenInProgressRevisionExists() {
        when(revisionRepository.existsByDocument_IdAndStatus_CodeIn(eq(document.getId()), anyList()))
                .thenReturn(true);

        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> {
            ReflectionTestUtils.invokeMethod(revisionService, "ensureNoRevisionInProgress", document.getId(), null);
        });

        assertTrue(exception.getMessage().contains("revision in progress"));
    }

    @Test
    public void upgradeRevision_shouldKeepSourceRevisionEffectiveAndDocumentActive() {
        UUID sourceRevisionId = UUID.randomUUID();
        DocumentRevisionRecord sourceRevision = new DocumentRevisionRecord();
        sourceRevision.setId(sourceRevisionId);
        sourceRevision.setRevisionNumber("2.0.0");
        sourceRevision.setDocument(document);
        
        RevisionStatusDefinition effectiveStatus = new RevisionStatusDefinition();
        effectiveStatus.setCode("EFFECTIVE");
        sourceRevision.setStatus(effectiveStatus);

        DocumentStatusDefinition activeStatus = new DocumentStatusDefinition();
        activeStatus.setCode("ACTIVE");
        document.setStatus(activeStatus);

        RevisionStatusDefinition draftStatus = new RevisionStatusDefinition();
        draftStatus.setCode("DRAFT");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(revisionRepository.findById(sourceRevisionId)).thenReturn(Optional.of(sourceRevision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        // TBR-DOC-015 concurrency mechanism: upgradeRevision now acquires a row lock on the
        // Document and forces a real reload of the source Revision (entityManager.refresh) before
        // proceeding -- both must be stubbed for this pre-existing test to still exercise the
        // method (the mocked EntityManager.refresh is a no-op, which is fine here since this test
        // is single-threaded and sourceRevision's in-memory state is already current).
        when(documentRepository.findByIdForUpdate(document.getId())).thenReturn(Optional.of(document));
        when(revisionStatusRepository.findById("DRAFT")).thenReturn(Optional.of(draftStatus));
        // #13: upgradeRevision copies participants via copyWorkflowParticipantsFromDocument, which
        // now re-validates SoD (including the unconditional "exactly one Approver" floor).
        when(documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(document.getId()))
                .thenReturn(List.of(workflowParticipant("APPROVER"), workflowParticipant("REVIEWER")));

        // When
        var response = revisionService.upgradeRevision(sourceRevisionId);

        // Then
        assertEquals("EFFECTIVE", sourceRevision.getStatus().getCode());
        assertEquals("ACTIVE", document.getStatus().getCode());
        assertNotNull(response);
        verify(revisionRepository).save(any(DocumentRevisionRecord.class));
        verify(revisionRepository, never()).findFirstByDocument_IdOrderByCreatedAtDesc(document.getId());
    }

    @Test
    void createRevision_rejectsTerminalDocumentEvenWhenARevisionExists() {
        DocumentStatusDefinition obsoleted = new DocumentStatusDefinition();
        obsoleted.setCode("OBSOLETED");
        document.setStatus(obsoleted);

        DocumentRevisionRecord effectiveRevision = new DocumentRevisionRecord();
        effectiveRevision.setId(UUID.randomUUID());

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        doNothing().when(documentAuthorizationService).requireCanManageRevisionWorkspace(currentUser);
        when(documentWorkflowParticipantRepository.findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER"))
                .thenReturn(List.of(workflowParticipant("APPROVER")));
        when(documentWorkflowParticipantRepository.findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER"))
                .thenReturn(List.of(workflowParticipant("REVIEWER")));
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(document.getId()))
                .thenReturn(Optional.of(effectiveRevision));

        assertThrows(IllegalStateException.class, () -> revisionService.createRevisionFromDocument(document.getId(), null));
        verify(revisionRepository, never()).save(any(DocumentRevisionRecord.class));
    }

    @Test
    void createInitialRevision_keepsDocumentDraftUntilSourceFileIsStored() {
        DocumentStatusDefinition draft = new DocumentStatusDefinition();
        draft.setCode("DRAFT");
        document.setStatus(draft);
        RevisionStatusDefinition draftRevisionStatus = new RevisionStatusDefinition();
        draftRevisionStatus.setCode("DRAFT");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        doNothing().when(documentAuthorizationService).requireCanManageRevisionWorkspace(currentUser);
        when(documentWorkflowParticipantRepository.findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER"))
                .thenReturn(List.of(workflowParticipant("APPROVER")));
        when(documentWorkflowParticipantRepository.findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER"))
                .thenReturn(List.of(workflowParticipant("REVIEWER")));
        when(documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(document.getId()))
                .thenReturn(List.of(workflowParticipant("APPROVER"), workflowParticipant("REVIEWER")));
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(document.getId())).thenReturn(Optional.empty());
        when(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId())).thenReturn(List.of());
        when(revisionStatusRepository.findById("DRAFT")).thenReturn(Optional.of(draftRevisionStatus));

        revisionService.createRevisionFromDocument(document.getId(), null);

        assertEquals("DRAFT", document.getStatus().getCode());
    }

    @Test
    void noReviewSubmission_isRejectedWhenNoPreviewExistsAndNoneWasRequested() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();

        assertThrows(IllegalStateException.class,
                () -> ReflectionTestUtils.invokeMethod(revisionService, "requirePdfPreviewReadyOrRequested", revision));
    }

    @Test
    void firstSourceFileStored_activatesOnlyInitialDraftDocument() {
        DocumentStatusDefinition draft = new DocumentStatusDefinition();
        draft.setCode("DRAFT");
        document.setStatus(draft);

        RevisionStatusDefinition active = new RevisionStatusDefinition();
        active.setCode("ACTIVE");
        DocumentStatusDefinition activeDocument = new DocumentStatusDefinition();
        activeDocument.setCode("ACTIVE");
        when(documentStatusRepository.findById("ACTIVE")).thenReturn(Optional.of(activeDocument));

        DocumentRevisionRecord initialRevision = new DocumentRevisionRecord();
        initialRevision.setId(UUID.randomUUID());

        ReflectionTestUtils.invokeMethod(
                revisionService,
                "activateDocumentAfterInitialSourceStored",
                document,
                initialRevision,
                currentUser
        );

        assertEquals("ACTIVE", document.getStatus().getCode());
        verify(documentRepository).save(document);
        // TBR-DOC-004: DRAFT->ACTIVE activation now produces its own explicit audit entry.
        verify(auditTrailService).logAs(
                eq(currentUser), eq("DOCUMENT"), any(), eq(document.getId()),
                eq("ACTIVATE"), eq("DRAFT"), eq("ACTIVE"), contains(initialRevision.getId().toString())
        );
    }

    @Test
    void publishRevision_rejectsTerminalDocumentBeforeConsumingSignature() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition ready = new RevisionStatusDefinition();
        ready.setCode("READY_FOR_PUBLISHING");
        revision.setStatus(ready);

        DocumentStatusDefinition obsoleted = new DocumentStatusDefinition();
        obsoleted.setCode("OBSOLETED");
        document.setStatus(obsoleted);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));

        assertThrows(IllegalStateException.class, () -> revisionService.publishRevision(
                revisionId,
                new RevisionWorkflowActionRequest("publish", "publish", "signature-token")
        ));

        verify(signatureTokenConsumptionService, never()).requireAndConsume(anyString(), any(UserAccount.class));
        verify(revisionRepository, never()).save(revision);
    }

    @Test
    public void publishRevision_withRelatedDocumentDraftInProgress_throwsException() {
        UUID revisionId = UUID.randomUUID();
        makeDocumentActive();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("1.0.1");
        revision.setDocument(document);

        RevisionStatusDefinition readyPublishStatus = new RevisionStatusDefinition();
        readyPublishStatus.setCode("READY_FOR_PUBLISHING");
        revision.setStatus(readyPublishStatus);

        // Related Document Setup -- its latest revision is DRAFT: a revision is in progress but
        // has not yet reached Ready for Publishing, so the batch publish must be blocked outright
        // (no Force Publish path exists any more).
        DocumentRecord relatedDoc = new DocumentRecord();
        relatedDoc.setId(UUID.randomUUID());
        relatedDoc.setDocumentNumber("FORM-001");
        relatedDoc.setDocumentName("Related Form");

        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(document);
        relation.setTargetDocument(relatedDoc);
        relation.setRelationType("RELATED");

        DocumentRevisionRecord latestRelatedRev = new DocumentRevisionRecord();
        latestRelatedRev.setDocument(relatedDoc);
        latestRelatedRev.setRevisionNumber("1.0.1");
        RevisionStatusDefinition relatedDraftStatus = new RevisionStatusDefinition();
        relatedDraftStatus.setCode("DRAFT");
        relatedDraftStatus.setLabel("Draft");
        latestRelatedRev.setStatus(relatedDraftStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED"))
                .thenReturn(List.of(relation));
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(relatedDoc.getId()))
                .thenReturn(Optional.of(latestRelatedRev));

        RevisionWorkflowActionRequest request = new RevisionWorkflowActionRequest("reason", "comment", "signature_token");

        // When/Then
        assertThrows(RelatedDocumentsNotEffectiveException.class, () -> {
            revisionService.publishRevision(revisionId, request);
        });
        verify(revisionRepository, never()).save(revision);
    }

    @Test
    public void publishRevision_withNoRelatedDocumentRevisionInProgress_proceedsNormally() {
        UUID revisionId = UUID.randomUUID();
        makeDocumentActive();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("1.0.1");
        revision.setDocument(document);

        RevisionStatusDefinition readyPublishStatus = new RevisionStatusDefinition();
        readyPublishStatus.setCode("READY_FOR_PUBLISHING");
        revision.setStatus(readyPublishStatus);

        // Related Document's latest revision is already EFFECTIVE (stable, not being revised
        // right now) -- nothing about it needs to publish together, so it must not block.
        DocumentRecord relatedDoc = new DocumentRecord();
        relatedDoc.setId(UUID.randomUUID());
        relatedDoc.setDocumentNumber("SOP-002");
        relatedDoc.setDocumentName("Related SOP");

        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(document);
        relation.setTargetDocument(relatedDoc);
        relation.setRelationType("RELATED");

        DocumentRevisionRecord effectiveRelatedRevision = new DocumentRevisionRecord();
        effectiveRelatedRevision.setId(UUID.randomUUID());
        effectiveRelatedRevision.setDocument(relatedDoc);
        RevisionStatusDefinition effectiveRelatedStatus = new RevisionStatusDefinition();
        effectiveRelatedStatus.setCode("EFFECTIVE");
        effectiveRelatedRevision.setStatus(effectiveRelatedStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED"))
                .thenReturn(List.of(relation));
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(relatedDoc.getId()))
                .thenReturn(Optional.of(effectiveRelatedRevision));

        RevisionStatusDefinition effectiveStatus = new RevisionStatusDefinition();
        effectiveStatus.setCode("EFFECTIVE");
        when(revisionStatusRepository.findById("EFFECTIVE")).thenReturn(Optional.of(effectiveStatus));

        DocumentStatusDefinition activeDocStatus = new DocumentStatusDefinition();
        activeDocStatus.setCode("ACTIVE");
        when(documentStatusRepository.findById("ACTIVE")).thenReturn(Optional.of(activeDocStatus));

        RevisionWorkflowActionRequest request = new RevisionWorkflowActionRequest("reason", "comment", "signature_token");

        // When
        var response = revisionService.publishRevision(revisionId, request);

        // Then
        assertNotNull(response);
        // The related document's own EFFECTIVE revision is never touched/re-saved -- it was not
        // part of the batch.
        verify(revisionRepository, never()).save(effectiveRelatedRevision);
    }

    // ── saveRevisionParticipantsFromRequest: partial-update semantics ──────────────────────────

    private DocumentDraftCreateRequest draftRequest(
            List<String> coAuthorIds, List<String> reviewerUserIds, List<String> approverUserIds
    ) {
        return new DocumentDraftCreateRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null,
                coAuthorIds, reviewerUserIds, approverUserIds, null, null, null, null, null
        );
    }

    private UserAccount userWithId(UUID id) {
        UserAccount user = new UserAccount();
        user.setId(id);
        return user;
    }

    private void makeDocumentActive() {
        DocumentStatusDefinition active = new DocumentStatusDefinition();
        active.setCode("ACTIVE");
        document.setStatus(active);
    }

    private DocumentWorkflowParticipant workflowParticipant(String type) {
        DocumentWorkflowParticipant participant = new DocumentWorkflowParticipant();
        participant.setParticipantType(type);
        participant.setSequenceOrder(1);
        participant.setUser(currentUser);
        return participant;
    }

    private RevisionWorkflowParticipant existingParticipant(String type, UserAccount user) {
        RevisionWorkflowParticipant participant = new RevisionWorkflowParticipant();
        participant.setParticipantType(type);
        participant.setUser(user);
        return participant;
    }

    @Test
    void saveRevisionParticipants_omittedApproverField_keepsExistingApprover() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        revision.setReviewRequirement(ReviewRequirement.NONE);

        UUID existingApproverId = UUID.randomUUID();
        UserAccount existingApprover = userWithId(existingApproverId);

        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "CO_AUTHOR"))
                .thenReturn(List.of());
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "REVIEWER"))
                .thenReturn(List.of());
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "APPROVER"))
                .thenReturn(List.of(existingParticipant("APPROVER", existingApprover)));
        when(documentWorkflowSettingRepository.findFirstByOrderByIdAsc()).thenReturn(Optional.of(new DocumentWorkflowSetting()));
        when(userAccountRepository.findById(existingApproverId)).thenReturn(Optional.of(existingApprover));

        // approverUserIds omitted (null) -- must be carried over from the DB, not wiped.
        DocumentDraftCreateRequest request = draftRequest(null, null, null);

        ReflectionTestUtils.invokeMethod(revisionService, "saveRevisionParticipantsFromRequest", revision, request);

        verify(revisionWorkflowParticipantRepository).save(argThat(p ->
                "APPROVER".equals(p.getParticipantType()) && existingApproverId.equals(p.getUser().getId())));
    }

    @Test
    void saveRevisionParticipants_explicitEmptyApproverList_throws() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        revision.setReviewRequirement(ReviewRequirement.NONE);

        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "CO_AUTHOR"))
                .thenReturn(List.of());
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "REVIEWER"))
                .thenReturn(List.of());
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "APPROVER"))
                .thenReturn(List.of(existingParticipant("APPROVER", userWithId(UUID.randomUUID()))));

        // approverUserIds explicitly sent as [] -- must be rejected: at least one Approver is a
        // GMP floor, never overridable by omission or by explicit clearing.
        DocumentDraftCreateRequest request = draftRequest(null, null, List.of());

        assertThrows(IllegalArgumentException.class, () ->
                ReflectionTestUtils.invokeMethod(revisionService, "saveRevisionParticipantsFromRequest", revision, request));

        verify(revisionWorkflowParticipantRepository, never()).deleteAllByRevision_Id(any());
    }

    // ── Complete Editing / Master-sync guards after Complete Authoring ─────────────────────────

    @Test
    void updateRevision_afterCompleteEditing_isRejected() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition draft = new RevisionStatusDefinition();
        draft.setCode("DRAFT");
        revision.setStatus(draft);
        revision.setEditingStatus("COMPLETED");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));

        RevisionLifecycleConflictException ex = assertThrows(RevisionLifecycleConflictException.class, () ->
                revisionService.updateRevision(revisionId, draftRequest(null, null, null)));
        assertEquals("REVISION_EDITING_ALREADY_COMPLETED", ex.getCode());

        verify(revisionWorkflowParticipantRepository, never()).deleteAllByRevision_Id(any());
    }

    @Test
    void syncDraftRevisionWithDocument_skipsRevisionThatCompletedEditing() {
        DocumentRevisionRecord draft = new DocumentRevisionRecord();
        draft.setId(UUID.randomUUID());
        draft.setDocument(document);
        draft.setEditingStatus("COMPLETED");

        when(revisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT"))
                .thenReturn(Optional.of(draft));

        revisionService.syncDraftRevisionWithDocument(document);

        verify(revisionRepository, never()).save(any());
        verify(revisionWorkflowParticipantRepository, never()).deleteAllByRevision_Id(any());
    }

    // ── Complete Editing requires a real, existing source file ─────────────────────────────────

    @Test
    void requireRevisionSourceFile_throwsWhenNoSourceFileResolvable() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        // No filePath, no previewFilePath, no sourceStorageObjectKey -- resolveRevisionSourceFile
        // falls through to scanning the on-disk revision storage folder, which will not exist for
        // a random UUID in the test environment, so it must resolve to null.

        assertThrows(RevisionLifecycleConflictException.class, () ->
                ReflectionTestUtils.invokeMethod(revisionService, "requireRevisionSourceFile", revision));
    }

    // ── S6: review-requirement snapshot drift between Document and Revision ────────────────────

    @Test
    void submitForReview_documentReviewRequirementChangedAfterRevisionSnapshot_isRejected() {
        // The Revision snapshotted REQUIRED at creation time; afterwards the Draft's Sub-Type was
        // switched to one that does not use review (Document snapshot now NONE). The reviewer set
        // assembled under the old rule is stale -- submitForReview must refuse with the stable
        // REVIEW_REQUIREMENT_CHANGED code, before any signature/side effect.
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition draft = new RevisionStatusDefinition();
        draft.setCode("DRAFT");
        revision.setStatus(draft);
        revision.setReviewRequirement(ReviewRequirement.REQUIRED);
        document.setReviewRequirement(ReviewRequirement.NONE);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        lenient().when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        lenient().when(revisionRepository.findByIdForUpdate(revisionId)).thenReturn(Optional.of(revision));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                revisionService.submitForReview(revisionId, new RevisionWorkflowActionRequest("reason", "comment", "sig")));
        assertTrue(ex.getMessage() != null && ex.getMessage().startsWith("REVIEW_REQUIREMENT_CHANGED"),
                "Expected REVIEW_REQUIREMENT_CHANGED, got: " + ex.getMessage());
        verify(electronicSignatureService, never())
                .hasRevisionSignatureMeaning(any(DocumentRevisionRecord.class), anyString());
        verify(revisionRepository, never()).save(any());
    }
}
