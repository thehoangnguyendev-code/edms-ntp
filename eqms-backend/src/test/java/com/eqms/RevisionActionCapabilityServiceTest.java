package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.security.FileAccessDecision;
import com.eqms.dto.security.RevisionActionCapabilitiesResponse;
import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.RevisionActionCapabilityService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionWorkflowAuthorizationService;
import com.eqms.service.SecureFileAccessService;
import com.eqms.service.WorkflowActionPolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RevisionActionCapabilityServiceTest {

    @Mock CurrentUserService currentUserService;
    @Mock DocumentRevisionRepository documentRevisionRepository;
    @Mock DocumentAuthorizationService documentAuthorizationService;
    @Mock RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    @Mock SecureFileAccessService secureFileAccessService;
    @Mock RevisionService revisionService;
    @Mock WorkflowActionPolicyService workflowActionPolicyService;

    RevisionActionCapabilityService service;

    private UserAccount user;
    private UUID revisionId;
    private DocumentRevisionRecord revision;

    @BeforeEach
    void setUp() {
        service = new RevisionActionCapabilityService(
                currentUserService,
                documentRevisionRepository,
                documentAuthorizationService,
                revisionWorkflowAuthorizationService,
                secureFileAccessService,
                revisionService,
                workflowActionPolicyService
        );
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        revisionId = UUID.randomUUID();
        revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setUpdatedAt(Instant.parse("2026-07-03T00:00:00Z"));
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        revision.setDocument(document);
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode("DRAFT");
        revision.setStatus(status);
        revision.setFilePath("/minio/source.docx");
        revision.setFileName("source.docx");
        revision.setPreviewFilePath("/minio/review.pdf");
        revision.setStorageEditUrl("https://office.example/edit");
        revision.setStorageItemId("item-1");
        revision.setStorageDriveId("drive-1");

        lenient().when(currentUserService.requireCurrentUser()).thenReturn(user);
        lenient().doNothing().when(documentAuthorizationService).requireCanViewRevision(eq(user), any());
        lenient().when(secureFileAccessService.check(eq(user), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    FileAccessAction action = invocation.getArgument(1);
                    FileObjectType objectType = invocation.getArgument(2);
                    return FileAccessDecision.allowed(action, objectType, revisionId, false);
                });
        lenient().when(revisionWorkflowAuthorizationService.check(eq(user), any(), any(), any()))
                .thenAnswer(invocation -> {
                    RevisionWorkflowAction action = invocation.getArgument(2);
                    return WorkflowAuthorizationDecision.allowed(action, revisionId, "DRAFT", false, false);
                });
        // F-07: resolveRequiredPermissionCode() now reads workflow_action_policies via this
        // service instead of a hardcoded switch — stub it to mirror the seeded production
        // mapping so the requiredPermissionCode assertions below stay meaningful.
        lenient().when(workflowActionPolicyService.resolvePolicy(any(RevisionWorkflowAction.class), anyString(), any()))
                .thenAnswer(invocation -> {
                    RevisionWorkflowAction action = invocation.getArgument(0);
                    String code = seededRequiredPermissionCode(action);
                    if (code == null) {
                        return Optional.empty();
                    }
                    WorkflowActionPolicy policy = new WorkflowActionPolicy();
                    policy.setRequiredPermissionCode(code);
                    return Optional.of(policy);
                });
    }

    private static String seededRequiredPermissionCode(RevisionWorkflowAction action) {
        return switch (action) {
            case COMPLETE_AUTHORING -> "documents.revision.complete_authoring";
            // V347: split out of the former catch-all documents.workspace.manage.
            case UPDATE_DRAFT_METADATA -> "documents.revision.update_draft_metadata";
            case OPEN_PUBLISHING_WORKSPACE -> "documents.revision.open_publishing_workspace";
            case SUBMIT_FOR_REVIEW -> "documents.revision.submit_review";
            case UPLOAD_SOURCE -> "documents.revision.upload_source";
            case GENERATE_REVIEW_SNAPSHOT, REGENERATE_SNAPSHOT -> "documents.revision.generate_preview";
            case COMPLETE_REVIEW -> "documents.revision.review";
            case REJECT_REVIEW -> "documents.revision.reject_review";
            case COMPLETE_APPROVAL -> "documents.revision.approve";
            case REJECT_APPROVAL -> "documents.revision.reject_approval";
            case COMPLETE_TRAINING -> "documents.revision.complete_training";
            case PUBLISH -> "documents.revision.publish";
            case CANCEL -> "documents.revision.cancel";
            case OBSOLETE -> null;
            case UPGRADE_REVISION -> "documents.revision.upgrade";
        };
    }

    @Test
    void getCapabilities_returnsActionMatrix() {
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.revisionId()).isEqualTo(revisionId);
        assertThat(response.documentId()).isEqualTo(revision.getDocument().getId());
        assertThat(response.actions()).containsKeys(
                "preview",
                "downloadSource",
                "editOnline",
                "uploadSource",
                "replaceSource",
                "syncToOffice",
                "syncFromOffice",
                "completeAuthoring",
                "updateDraftMetadata",
                "openPublishingWorkspace",
                "generateReviewSnapshot",
                "regenerateSnapshot",
                "submitForReview",
                "completeReview",
                "rejectReview",
                "completeApproval",
                "rejectApproval",
                "completeTraining",
                "publish",
                "cancel",
                "upgradeRevision"
        );
        assertThat(response.actions().get("preview").allowed()).isTrue();
        assertThat(response.actions().get("publish").allowed()).isTrue();
        assertThat(response.actions().get("completeReview").requiredPermissionCode()).isEqualTo("documents.revision.review");
        assertThat(response.actions().get("completeApproval").requiredPermissionCode()).isEqualTo("documents.revision.approve");
        assertThat(response.actions().get("completeTraining").requiredPermissionCode()).isEqualTo("documents.revision.complete_training");
        assertThat(response.actions().get("downloadSource").requiredPermissionCode()).isEqualTo("documents.revision.download_source");
        assertThat(response.actions().get("updateDraftMetadata").requiredPermissionCode()).isEqualTo("documents.revision.update_draft_metadata");
    }

    @Test
    void getCapabilities_allowsSourceUploadOnlyForAssignedRevisionAuthor() {
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(documentAuthorizationService.canUploadRevisionSource(user, revision)).thenReturn(true);

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("uploadSource").allowed()).isTrue();
        assertThat(response.actions().get("replaceSource").allowed()).isTrue();
    }

    @Test
    void getCapabilities_deniesSourceUploadForNonAuthorBeforeFilePermissionCheck() {
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(documentAuthorizationService.canUploadRevisionSource(user, revision)).thenReturn(false);

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("uploadSource").allowed()).isFalse();
        assertThat(response.actions().get("uploadSource").reasonCode()).isEqualTo("NOT_REVISION_AUTHOR");
        assertThat(response.actions().get("replaceSource").reasonCode()).isEqualTo("NOT_REVISION_AUTHOR");
        verify(secureFileAccessService, never()).check(
                eq(user), eq(FileAccessAction.UPLOAD), eq(FileObjectType.SOURCE_DOCX), eq(revisionId), any());
        verify(secureFileAccessService, never()).check(
                eq(user), eq(FileAccessAction.REPLACE), eq(FileObjectType.SOURCE_DOCX), eq(revisionId), any());
    }

    @Test
    void getCapabilities_deniesEditOnlineWhenOfficeWorkspaceMissing() {
        revision.setStorageEditUrl(null);
        revision.setStorageItemId(null);
        revision.setStorageDriveId(null);
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("editOnline").allowed()).isFalse();
        assertThat(response.actions().get("editOnline").reasonCode()).isEqualTo("FILE_NOT_FOUND");
        // syncToOffice is the action that CREATES the Office Online workspace, so it must remain
        // available when no workspace exists yet — only syncFromOffice requires one already.
        assertThat(response.actions().get("syncToOffice").allowed()).isTrue();
        assertThat(response.actions().get("syncFromOffice").allowed()).isFalse();
        assertThat(response.actions().get("syncFromOffice").reasonCode()).isEqualTo("FILE_NOT_FOUND");
    }

    @Test
    void getCapabilities_deniesSyncToOfficeWhenWorkspaceAlreadyExists() {
        // Default setUp() already has an Office workspace (storageEditUrl/Item/Drive set) —
        // once it exists, "upload to Office" no longer makes sense (Edit Online takes over).
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("syncToOffice").allowed()).isFalse();
        assertThat(response.actions().get("syncToOffice").reasonCode()).isEqualTo("ALREADY_SYNCED");
        assertThat(response.actions().get("editOnline").allowed()).isTrue();
    }

    @Test
    void getCapabilities_deniesPreviewWhenNoPreviewFileExists() {
        revision.setPreviewFilePath(null);
        revision.setFilePath(null);
        revision.setStorageEditUrl(null);
        revision.setStorageViewUrl(null);
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("preview").allowed()).isFalse();
        assertThat(response.actions().get("preview").reasonCode()).isEqualTo("FILE_NOT_FOUND");
    }

    @Test
    void capabilityEvaluation_doesNotMutateRevisionStatus() {
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        String beforeStatus = revision.getStatus().getCode();

        service.getCapabilities(revisionId);

        assertThat(revision.getStatus().getCode()).isEqualTo(beforeStatus);
        verify(documentRevisionRepository, never()).save(any());
    }

    @Test
    void capabilityEvaluation_unauthenticatedUserIsRejected() {
        when(currentUserService.requireCurrentUser()).thenThrow(new UnauthorizedException("Authentication required"));

        assertThatThrownBy(() -> service.getCapabilities(revisionId))
                .isInstanceOf(UnauthorizedException.class);

        verifyNoInteractions(documentRevisionRepository, documentAuthorizationService, secureFileAccessService, revisionWorkflowAuthorizationService);
    }

    // ── F-07: requiredPermissionCode must reflect the DB policy, not a hardcoded value ─────────

    @Test
    void requiredPermissionCode_reflectsPolicyRepointedAtRuntime_notAHardcodedValue() {
        // Simulates an admin repointing COMPLETE_REVIEW's required permission via the Workflow
        // Authorization UI to something OTHER than the "normal" seeded value. If this service
        // were still reading from a hardcoded switch, the response would show the old value.
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        WorkflowActionPolicy repointed = new WorkflowActionPolicy();
        repointed.setRequiredPermissionCode("documents.revision.review.custom_repointed");
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("DRAFT"), any()))
                .thenReturn(Optional.of(repointed));

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("completeReview").requiredPermissionCode())
                .isEqualTo("documents.revision.review.custom_repointed");
    }

    @Test
    void requiredPermissionCode_isNullWhenNoPolicyIsConfigured() {
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        when(workflowActionPolicyService.resolvePolicy(eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("DRAFT"), any()))
                .thenReturn(Optional.empty());

        RevisionActionCapabilitiesResponse response = service.getCapabilities(revisionId);

        assertThat(response.actions().get("completeReview").requiredPermissionCode()).isNull();
    }

    @Test
    void resolveRequiredPermissionCode_looksUpByRevisionDocumentTypeAndCurrentStatus() {
        UUID documentTypeId = UUID.randomUUID();
        com.eqms.entity.DocumentType documentType = new com.eqms.entity.DocumentType();
        documentType.setId(documentTypeId);
        revision.getDocument().setDocumentType(documentType);
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));

        service.getCapabilities(revisionId);

        verify(workflowActionPolicyService).resolvePolicy(
                eq(RevisionWorkflowAction.COMPLETE_REVIEW), eq("DRAFT"), eq(documentTypeId));
    }

    @Test
    void capabilityEvaluation_authenticatedUserWithoutViewAccessIsRejected() {
        when(documentRevisionRepository.findById(revisionId)).thenReturn(Optional.of(revision));
        doThrow(new AccessDeniedException("denied")).when(documentAuthorizationService).requireCanViewRevision(eq(user), any());

        assertThatThrownBy(() -> service.getCapabilities(revisionId))
                .isInstanceOf(AccessDeniedException.class);

        verify(secureFileAccessService, never()).check(any(), any(), any(), any(), any());
        verify(revisionWorkflowAuthorizationService, never()).check(any(), any(), any(), any());
    }
}
