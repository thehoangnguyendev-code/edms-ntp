package com.eqms;

import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.auth.*;
import com.eqms.exception.RelatedDocumentsNotEffectiveException;
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
    @Mock private OfficeOnlineConfigurationService officeOnlineConfigurationService;
    @Mock private MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;
    @Mock private SharePointPathBuilder sharePointPathBuilder;
    @Mock private FileStorageService fileStorageService;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private RevisionPublishingMetadataRepository publishingMetadataRepository;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private PublishingPdfComposerService publishingPdfComposerService;
    @Mock private ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    @Mock private NotificationRealtimeService notificationRealtimeService;
    @Mock private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    @Mock private SecureFileAccessService secureFileAccessService;

    @InjectMocks
    private RevisionService revisionService;

    private UserAccount currentUser;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
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
        lenient().when(microsoftGraphOfficeOnlineService.isConfigured()).thenReturn(false);
        lenient().when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(
                new TokenService.ParsedAccessToken(
                        "signature",
                        new AuthenticatedUser(currentUser.getId(), UUID.randomUUID(), currentUser.getUsername(), "USER", java.util.Collections.emptySet())
                )
        ));
    }

    @Test
    void syncFromOfficeOnline_deniesDirectApiCallWhenFileAccessPolicyDenies() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);
        RevisionStatusDefinition draft = new RevisionStatusDefinition();
        draft.setCode("DRAFT");
        revision.setStatus(draft);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        doNothing().when(documentAuthorizationService).requireCanUploadRevision(currentUser, document);
        doThrow(new org.springframework.security.access.AccessDeniedException("missing permission"))
                .when(secureFileAccessService)
                .require(eq(currentUser), eq(FileAccessAction.SYNC_FROM_OFFICE), eq(FileObjectType.SOURCE_DOCX), eq(revisionId), any());

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> revisionService.syncEditedFileFromOfficeOnline(revisionId));

        verify(secureFileAccessService).require(
                eq(currentUser), eq(FileAccessAction.SYNC_FROM_OFFICE), eq(FileObjectType.SOURCE_DOCX), eq(revisionId), any());
        verifyNoInteractions(microsoftGraphOfficeOnlineService);
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
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
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
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
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
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));

        assertThrows(IllegalStateException.class, () -> revisionService.cancelRevision(
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
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(revisionRepository.existsByDocument_IdAndStatus_CodeInAndIdNot(eq(document.getId()), anyList(), eq(revisionId)))
                .thenReturn(false);
        when(revisionStatusRepository.findById("CLOSED_CANCELLED")).thenReturn(Optional.of(cancelledStatus));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(documentStatusRepository.findById("CLOSED_CANCELLED")).thenReturn(Optional.of(closedCancelledStatus));

        revisionService.cancelRevision(
                revisionId,
                new RevisionWorkflowActionRequest("Cancel final revision", "Cancel final revision", "token")
        );

        assertEquals("CLOSED_CANCELLED", revision.getStatus().getCode());
        assertEquals("CLOSED_CANCELLED", document.getStatus().getCode());
        verify(revisionRepository).save(revision);
        verify(documentRepository).save(document);
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
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
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
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(document.getId()))
                .thenReturn(Optional.of(sourceRevision));
        when(revisionStatusRepository.findById("DRAFT")).thenReturn(Optional.of(draftStatus));

        // When
        var response = revisionService.upgradeRevision(sourceRevisionId);

        // Then
        assertEquals("EFFECTIVE", sourceRevision.getStatus().getCode());
        assertEquals("ACTIVE", document.getStatus().getCode());
        assertNotNull(response);
        verify(revisionRepository).save(any(DocumentRevisionRecord.class));
    }

    @Test
    public void publishRevision_withNonEffectiveRelatedDocuments_throwsException() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("1.0.1");
        revision.setDocument(document);
        
        RevisionStatusDefinition readyPublishStatus = new RevisionStatusDefinition();
        readyPublishStatus.setCode("READY_FOR_PUBLISHING");
        revision.setStatus(readyPublishStatus);

        // Related Document Setup
        DocumentRecord relatedDoc = new DocumentRecord();
        relatedDoc.setId(UUID.randomUUID());
        relatedDoc.setDocumentNumber("FORM-001");
        relatedDoc.setDocumentName("Related Form");

        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(document);
        relation.setTargetDocument(relatedDoc);
        relation.setRelationType("Related");

        DocumentRevisionRecord latestRelatedRev = new DocumentRevisionRecord();
        latestRelatedRev.setDocument(relatedDoc);
        latestRelatedRev.setRevisionNumber("1.0.1");
        RevisionStatusDefinition relatedDraftStatus = new RevisionStatusDefinition();
        relatedDraftStatus.setCode("DRAFT");
        relatedDraftStatus.setLabel("Draft");
        latestRelatedRev.setStatus(relatedDraftStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "Related"))
                .thenReturn(List.of(relation));
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(relatedDoc.getId()))
                .thenReturn(Optional.of(latestRelatedRev));

        // Mock tokenService
        AuthenticatedUser authUser = new AuthenticatedUser(currentUser.getId(), UUID.randomUUID(), "testuser", "USER", java.util.Collections.emptySet());
        TokenService.ParsedAccessToken parsedToken = new TokenService.ParsedAccessToken("signature", authUser);
        when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(parsedToken));

        RevisionWorkflowActionRequest request = new RevisionWorkflowActionRequest("reason", "comment", "signature_token");

        // When/Then
        assertThrows(RelatedDocumentsNotEffectiveException.class, () -> {
            revisionService.publishRevision(revisionId, request);
        });
    }

    @Test
    public void publishRevision_withNonEffectiveRelatedDocuments_forcePublish_proceedsNormally() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("1.0.1");
        revision.setDocument(document);
        
        RevisionStatusDefinition readyPublishStatus = new RevisionStatusDefinition();
        readyPublishStatus.setCode("READY_FOR_PUBLISHING");
        revision.setStatus(readyPublishStatus);

        // Related Document Setup
        DocumentRecord relatedDoc = new DocumentRecord();
        relatedDoc.setId(UUID.randomUUID());
        relatedDoc.setDocumentNumber("FORM-001");
        relatedDoc.setDocumentName("Related Form");

        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(document);
        relation.setTargetDocument(relatedDoc);
        relation.setRelationType("Related");

        DocumentRevisionRecord latestRelatedRev = new DocumentRevisionRecord();
        latestRelatedRev.setDocument(relatedDoc);
        latestRelatedRev.setRevisionNumber("1.0.1");
        RevisionStatusDefinition relatedDraftStatus = new RevisionStatusDefinition();
        relatedDraftStatus.setCode("DRAFT");
        relatedDraftStatus.setLabel("Draft");
        latestRelatedRev.setStatus(relatedDraftStatus);

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "Related"))
                .thenReturn(List.of(relation));
        when(revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(relatedDoc.getId()))
                .thenReturn(Optional.of(latestRelatedRev));

        // Mock tokenService
        AuthenticatedUser authUser = new AuthenticatedUser(currentUser.getId(), UUID.randomUUID(), "testuser", "USER", java.util.Collections.emptySet());
        TokenService.ParsedAccessToken parsedToken = new TokenService.ParsedAccessToken("signature", authUser);
        when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(parsedToken));

        RevisionStatusDefinition effectiveStatus = new RevisionStatusDefinition();
        effectiveStatus.setCode("EFFECTIVE");
        when(revisionStatusRepository.findById("EFFECTIVE")).thenReturn(Optional.of(effectiveStatus));

        DocumentStatusDefinition activeDocStatus = new DocumentStatusDefinition();
        activeDocStatus.setCode("ACTIVE");
        when(documentStatusRepository.findById("ACTIVE")).thenReturn(Optional.of(activeDocStatus));

        RevisionWorkflowActionRequest request = new RevisionWorkflowActionRequest("reason", "comment", "signature_token", true);

        // When
        var response = revisionService.publishRevision(revisionId, request);

        // Then
        assertNotNull(response);
        verify(auditTrailService).logAs(
                eq(currentUser),
                eq("REVISION"),
                any(),
                eq(revisionId),
                eq("WARNING_OVERRIDE"),
                any(),
                eq("EFFECTIVE"),
                contains("FORM-001 - Draft")
        );
    }

    @Test
    public void publishRevision_withNonEffectiveCorrelatedDocuments_ignoresAndProceedsNormally() {
        UUID revisionId = UUID.randomUUID();
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setRevisionNumber("1.0.1");
        revision.setDocument(document);
        
        RevisionStatusDefinition readyPublishStatus = new RevisionStatusDefinition();
        readyPublishStatus.setCode("READY_FOR_PUBLISHING");
        revision.setStatus(readyPublishStatus);

        // Correlated Document Setup - should be ignored
        DocumentRecord correlatedDoc = new DocumentRecord();
        correlatedDoc.setId(UUID.randomUUID());
        correlatedDoc.setDocumentNumber("SOP-002");
        correlatedDoc.setDocumentName("Correlated SOP");

        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(document);
        relation.setTargetDocument(correlatedDoc);
        relation.setRelationType("Correlated");

        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(revisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(documentRepository.findById(document.getId())).thenReturn(Optional.of(document));
        // Note: findBySourceDocument_IdAndRelationType with "Related" will return empty list because relations are "Correlated"
        when(documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "Related"))
                .thenReturn(List.of());

        // Mock tokenService
        AuthenticatedUser authUser = new AuthenticatedUser(currentUser.getId(), UUID.randomUUID(), "testuser", "USER", java.util.Collections.emptySet());
        TokenService.ParsedAccessToken parsedToken = new TokenService.ParsedAccessToken("signature", authUser);
        when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(parsedToken));

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
        verify(auditTrailService, never()).logAs(
                any(), any(), any(), any(), eq("WARNING_OVERRIDE"), any(), any(), any()
        );
    }
}
