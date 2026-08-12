package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.*;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.WorkflowActorType;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * T-P1-4 (F-08/Q1): Complete Editing -> DCO handover and DCO Cancel -> Author/Co-Author
 * notifications. Recipients must be resolved from the live SUBMIT_FOR_REVIEW policy actors
 * (not hard-coded), so changing the policy actor changes who gets notified.
 */
@ExtendWith(MockitoExtension.class)
class NotificationHandoverTest {

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
    @Mock private WorkflowActionPolicyService workflowActionPolicyService;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private UserAccountRepository userAccountRepository;

    @InjectMocks
    private RevisionService revisionService;

    private UserAccount author;
    private DocumentRecord document;
    private DocumentRevisionRecord revision;

    @BeforeEach
    void setUp() {
        author = new UserAccount();
        author.setId(UUID.randomUUID());
        author.setUsername("author");
        author.setStatus(UserStatus.Active);

        document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDocumentName("Test Document");
        document.setDocumentNumber("DOC-001");
        document.setAuthor(author);
        DocumentStatusDefinition ds = new DocumentStatusDefinition();
        ds.setCode("DRAFT");
        document.setStatus(ds);

        revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        RevisionStatusDefinition draft = new RevisionStatusDefinition();
        draft.setCode("DRAFT");
        revision.setStatus(draft);

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
                        new com.eqms.auth.AuthenticatedUser(author.getId(), UUID.randomUUID(), author.getUsername(), "USER", java.util.Collections.emptySet())
                )
        ));
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(author);
        lenient().when(revisionRepository.findById(revision.getId())).thenReturn(Optional.of(revision));
        lenient().when(electronicSignatureService.hasRevisionSignatureMeaning(any(DocumentRevisionRecord.class), anyString())).thenReturn(true);
    }

    private WorkflowActionPolicy policyWithAccessProfileActors(String... profileCodes) {
        WorkflowActionPolicy policy = new WorkflowActionPolicy();
        for (String code : profileCodes) {
            WorkflowActionPolicyActor actor = new WorkflowActionPolicyActor();
            actor.setActorType(WorkflowActorType.ACCESS_PROFILE);
            actor.setActorCode(code);
            policy.getActors().add(actor);
        }
        return policy;
    }

    @Test
    void completeEditing_notifiesUsersHoldingCurrentSubmitForReviewPolicyActors() {
        UserAccount dcoUser = new UserAccount();
        dcoUser.setId(UUID.randomUUID());
        dcoUser.setStatus(UserStatus.Active);

        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.SUBMIT_FOR_REVIEW), eq("DRAFT"), any()))
                .thenReturn(Optional.of(policyWithAccessProfileActors("DCO", "DOCUMENT_CONTROLLER")));
        when(userAccessProfileRepository.findUserIdsByProfileCodes(List.of("DCO", "DOCUMENT_CONTROLLER")))
                .thenReturn(List.of(dcoUser.getId()));
        when(userAccountRepository.findAllById(List.of(dcoUser.getId()))).thenReturn(List.of(dcoUser));
        when(emailNotificationService.buildDocumentVariables(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of());

        revisionService.completeEditing(revision.getId(), new RevisionWorkflowActionRequest("done", "done", "token"));

        ArgumentCaptor<Collection<UserAccount>> recipientsCaptor = captorForRecipients();
        verify(emailNotificationService).sendDocumentWorkflowNotification(
                eq("document-ready-for-submission"), recipientsCaptor.capture(), any());
        assertThat(recipientsCaptor.getValue()).containsExactly(dcoUser);
    }

    @Test
    void completeEditing_recipientsFollowPolicyActorChange_notHardCoded() {
        UserAccount newActorUser = new UserAccount();
        newActorUser.setId(UUID.randomUUID());
        newActorUser.setStatus(UserStatus.Active);

        // A different Access Profile code is now configured as the SUBMIT_FOR_REVIEW actor.
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.SUBMIT_FOR_REVIEW), eq("DRAFT"), any()))
                .thenReturn(Optional.of(policyWithAccessProfileActors("QUALITY_REVIEWER")));
        when(userAccessProfileRepository.findUserIdsByProfileCodes(List.of("QUALITY_REVIEWER")))
                .thenReturn(List.of(newActorUser.getId()));
        when(userAccountRepository.findAllById(List.of(newActorUser.getId()))).thenReturn(List.of(newActorUser));
        when(emailNotificationService.buildDocumentVariables(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of());

        revisionService.completeEditing(revision.getId(), new RevisionWorkflowActionRequest("done", "done", "token"));

        ArgumentCaptor<Collection<UserAccount>> recipientsCaptor = captorForRecipients();
        verify(emailNotificationService).sendDocumentWorkflowNotification(
                eq("document-ready-for-submission"), recipientsCaptor.capture(), any());
        assertThat(recipientsCaptor.getValue()).containsExactly(newActorUser);
        verify(userAccessProfileRepository, never()).findUserIdsByProfileCodes(List.of("DCO", "DOCUMENT_CONTROLLER"));
    }

    @Test
    void completeEditing_noConfiguredPolicy_sendsNoNotification() {
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.SUBMIT_FOR_REVIEW), eq("DRAFT"), any()))
                .thenReturn(Optional.empty());

        revisionService.completeEditing(revision.getId(), new RevisionWorkflowActionRequest("done", "done", "token"));

        verify(emailNotificationService, never()).sendDocumentWorkflowNotification(anyString(), any(), any());
    }

    @Test
    void cancelRevision_notifiesAuthorAndCoAuthorsWithCancelReason() {
        UserAccount dco = new UserAccount();
        dco.setId(UUID.randomUUID());
        dco.setUsername("dco");
        dco.setStatus(UserStatus.Active);
        // Cancel is performed by DCO (D-5), not the Author, so the Author must be notified.
        when(currentUserService.requireCurrentUser()).thenReturn(dco);
        when(tokenService.parseSignatureToken(anyString())).thenReturn(Optional.of(
                new TokenService.ParsedAccessToken(
                        "signature",
                        new com.eqms.auth.AuthenticatedUser(dco.getId(), UUID.randomUUID(), dco.getUsername(), "USER", java.util.Collections.emptySet())
                )
        ));

        UserAccount coAuthor = new UserAccount();
        coAuthor.setId(UUID.randomUUID());
        coAuthor.setStatus(UserStatus.Active);
        RevisionWorkflowParticipant coAuthorParticipant = new RevisionWorkflowParticipant();
        coAuthorParticipant.setUser(coAuthor);

        RevisionStatusDefinition cancelledStatus = new RevisionStatusDefinition();
        cancelledStatus.setCode("CLOSED_CANCELLED");
        when(revisionStatusRepository.findById("CLOSED_CANCELLED")).thenReturn(Optional.of(cancelledStatus));
        when(revisionRepository.existsByDocument_IdAndStatus_CodeInAndIdNot(eq(document.getId()), any(), eq(revision.getId())))
                .thenReturn(true);
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(
                revision.getId(), "CO_AUTHOR")).thenReturn(List.of(coAuthorParticipant));
        when(emailNotificationService.buildDocumentVariables(any(), any(), any(), any(), any(), eq("cancel reason"), any()))
                .thenReturn(Map.of());

        revisionService.cancelRevision(revision.getId(), new RevisionWorkflowActionRequest("cancel reason", "cancel reason", "token"));

        ArgumentCaptor<Collection<UserAccount>> recipientsCaptor = captorForRecipients();
        verify(emailNotificationService, org.mockito.Mockito.times(2)).sendDocumentWorkflowNotification(
                eq("document-revision-cancelled"), recipientsCaptor.capture(), any());
        List<UserAccount> notified = recipientsCaptor.getAllValues().stream()
                .flatMap(Collection::stream)
                .toList();
        assertThat(notified).containsExactlyInAnyOrder(author, coAuthor);
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<Collection<UserAccount>> captorForRecipients() {
        return (ArgumentCaptor<Collection<UserAccount>>) (ArgumentCaptor<?>) ArgumentCaptor.forClass(Collection.class);
    }
}
