package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.ResourceCapabilitiesResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.DocumentMasterActionCapabilityService;
import com.eqms.service.DocumentMasterWorkflowAuthorizationService;
import com.eqms.service.DocumentService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guards the Document Master capability contract used by the detail UI.  These tests intentionally
 * exercise status, assignment and permission combinations independently of display-role names.
 */
@ExtendWith(MockitoExtension.class)
class DocumentMasterActionCapabilityServiceTest {

    @Mock CurrentUserService currentUserService;
    @Mock DocumentRecordRepository documentRepository;
    @Mock DocumentRevisionRepository documentRevisionRepository;
    @Mock DocumentAuthorizationService documentAuthorizationService;
    @Mock DocumentMasterWorkflowAuthorizationService workflowAuthorizationService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock DocumentService documentService;

    private DocumentMasterActionCapabilityService service;
    private UserAccount user;
    private DocumentRecord document;
    private UUID documentId;

    @BeforeEach
    void setUp() {
        service = new DocumentMasterActionCapabilityService(
                currentUserService,
                documentRepository,
                documentRevisionRepository,
                documentAuthorizationService,
                workflowAuthorizationService,
                permissionEvaluationService,
                documentService
        );

        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        documentId = UUID.randomUUID();
        document = new DocumentRecord();
        document.setId(documentId);
        document.setStatus(status("ACTIVE"));

        lenient().when(currentUserService.requireCurrentUser()).thenReturn(user);
        lenient().when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        lenient().when(documentAuthorizationService.canViewDocument(user, document)).thenReturn(true);
        lenient().when(documentAuthorizationService.canEditInitialDocumentDraft(user, document)).thenReturn(false);
        lenient().when(documentAuthorizationService.canUploadRevision(user, document)).thenReturn(true);
        lenient().when(documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE"))
                .thenReturn(Optional.of(new com.eqms.entity.DocumentRevisionRecord()));
        lenient().when(documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(eq(documentId), any()))
                .thenReturn(false);
        lenient().when(permissionEvaluationService.hasPermission(eq(user), anyString())).thenReturn(true);
        lenient().when(documentService.isNextRevisionConfigurable(document)).thenReturn(true);
        lenient().when(workflowAuthorizationService.check(eq(user), eq(document), anyString()))
                .thenAnswer(invocation -> new DocumentMasterWorkflowAuthorizationService.Decision(
                        true, null, null, "documents.document.lifecycle"));
    }

    @Test
    void activeEffectiveDocument_returnsTheSharedActionContract() {
        ResourceCapabilitiesResponse response = service.getCapabilities(documentId);

        assertThat(response.resourceType()).isEqualTo("DOCUMENT_MASTER");
        assertThat(response.actions()).containsKeys(
                "view", "editInitialDraft", "uploadRevision", "requestControlledCopy",
                "configureNextReviewers", "configureNextApprovers", "configureNextRelatedDocuments",
                "configureNextCorrelatedDocuments", "manageReviewCycle", "cancel", "obsolete");
        assertThat(response.actions().get("uploadRevision").allowed()).isTrue();
        assertThat(response.actions().get("requestControlledCopy").requiredPermissionCode())
                .isEqualTo("documents.controlled_copy.request");
        assertThat(response.actions().get("configureNextReviewers").requiredPermissionCode())
                .isEqualTo("documents.revision.configure_next_reviewers");
        assertThat(response.actions().get("obsolete").requiresESignature()).isTrue();
    }

    @Test
    void uploadRevision_requiresAssignedAuthorAndOpenRevisionMustBeClosed() {
        when(documentAuthorizationService.canUploadRevision(user, document)).thenReturn(false);

        ResourceCapabilitiesResponse notAuthor = service.getCapabilities(documentId);
        assertThat(notAuthor.actions().get("uploadRevision").allowed()).isFalse();
        assertThat(notAuthor.actions().get("uploadRevision").reasonCode()).isEqualTo("NOT_DOCUMENT_AUTHOR");

        when(documentAuthorizationService.canUploadRevision(user, document)).thenReturn(true);
        when(documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(eq(documentId), any())).thenReturn(true);

        ResourceCapabilitiesResponse hasOpenRevision = service.getCapabilities(documentId);
        assertThat(hasOpenRevision.actions().get("uploadRevision").allowed()).isFalse();
        assertThat(hasOpenRevision.actions().get("uploadRevision").reasonCode()).isEqualTo("DOCUMENT_HAS_OPEN_REVISIONS");
    }

    @Test
    void nextRevisionConfiguration_requiresEffectiveDocumentAndItsOwnPermission() {
        when(permissionEvaluationService.hasPermission(user, "documents.revision.configure_next_approvers")).thenReturn(false);

        ResourceCapabilitiesResponse deniedByPermission = service.getCapabilities(documentId);
        assertThat(deniedByPermission.actions().get("configureNextApprovers").allowed()).isFalse();
        assertThat(deniedByPermission.actions().get("configureNextApprovers").reasonCode())
                .isEqualTo("CONFIGURE_APPROVERS_NOT_ALLOWED");

        document.setStatus(status("DRAFT"));
        ResourceCapabilitiesResponse deniedByLifecycle = service.getCapabilities(documentId);
        assertThat(deniedByLifecycle.actions().get("configureNextReviewers").allowed()).isFalse();
        assertThat(deniedByLifecycle.actions().get("requestControlledCopy").allowed()).isFalse();
    }

    @Test
    void nextRevisionConfiguration_isBlockedOnceTheInProgressRevisionIsNoLongerConfigurable() {
        // e.g. it moved past Draft, or the Author already uploaded it to Office Online -- the
        // button must never render/be clickable at that point, not just fail when Saved.
        when(documentService.isNextRevisionConfigurable(document)).thenReturn(false);

        ResourceCapabilitiesResponse response = service.getCapabilities(documentId);

        assertThat(response.actions().get("configureNextReviewers").allowed()).isFalse();
        assertThat(response.actions().get("configureNextReviewers").reasonCode())
                .isEqualTo("NEXT_REVISION_NOT_CONFIGURABLE");
        assertThat(response.actions().get("configureNextApprovers").allowed()).isFalse();
        assertThat(response.actions().get("configureNextRelatedDocuments").allowed()).isFalse();
        assertThat(response.actions().get("configureNextCorrelatedDocuments").allowed()).isFalse();
        assertThat(response.actions().get("manageReviewCycle").allowed()).isFalse();
        // Unrelated actions must not be affected.
        assertThat(response.actions().get("requestControlledCopy").allowed()).isTrue();
    }

    @Test
    void capabilityEndpoint_failsClosedWhenDocumentCannotBeViewed() {
        when(documentAuthorizationService.canViewDocument(user, document)).thenReturn(false);

        assertThatThrownBy(() -> service.getCapabilities(documentId))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Document access denied");

        verify(permissionEvaluationService, never()).hasPermission(any(), anyString());
        verify(workflowAuthorizationService, never()).check(any(), any(), anyString());
    }

    private static DocumentStatusDefinition status(String code) {
        DocumentStatusDefinition status = new DocumentStatusDefinition();
        status.setCode(code);
        return status;
    }
}
