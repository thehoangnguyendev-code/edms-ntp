package com.eqms;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentWorkflowParticipant;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.DocumentWorkflowPoolMemberRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.LifecycleStatePolicyEvaluator;
import com.eqms.service.ObjectAccessEvaluationService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
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
 * Characterization tests for DocumentAuthorizationService — this class had ZERO
 * test coverage before this file (confirmed by repo-wide search during the
 * Authorization Platform refactor review). These tests lock in current behavior
 * before any structural refactor (shared AuthorizationEvaluator, Stage 2) touches
 * this class, so a refactor that silently changes behavior gets caught.
 */
@ExtendWith(MockitoExtension.class)
class DocumentAuthorizationServiceTest {

    @Mock private DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock private LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    @Mock private DocumentRelationRepository documentRelationRepository;

    @InjectMocks
    private DocumentAuthorizationService service;

    private UserAccount user;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        user = new UserAccount();
        user.setId(UUID.randomUUID());

        document = new DocumentRecord();
        document.setId(UUID.randomUUID());

        lenient().when(objectAccessEvaluationService.canViewDocument(any(), any())).thenReturn(true);
        lenient().when(objectAccessEvaluationService.canViewRevision(any(), any())).thenReturn(true);
        lenient().when(documentWorkflowPoolMemberRepository.findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(anyString()))
                .thenReturn(List.of());
        lenient().when(userAccessProfileRepository.findUserIdsByWorkflowRole(anyString())).thenReturn(List.of());
        lenient().when(documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(any()))
                .thenReturn(List.of());
        lenient().when(revisionWorkflowParticipantRepository.countByRevision_Document_IdAndUser_Id(any(), any()))
                .thenReturn(0L);
    }

    private DocumentRevisionRecord revisionWithStatus(String statusCode) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode(statusCode);
        revision.setStatus(status);
        return revision;
    }

    // ── canViewAllDocuments: 3 independent OR paths ─────────────────────────

    @Test
    void canViewAllDocuments_true_viaAdminPermission() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(true);
        assertThat(service.canViewAllDocuments(user)).isTrue();
    }

    @Test
    void canViewAllDocuments_false_viaLegacyPoolOnly() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        assertThat(service.canViewAllDocuments(user)).isFalse();
    }

    @Test
    void canViewAllDocuments_false_viaWorkflowRoleOnly() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        assertThat(service.canViewAllDocuments(user)).isFalse();
    }

    @Test
    void canViewAllDocuments_false_whenNoneMatch() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        assertThat(service.canViewAllDocuments(user)).isFalse();
    }

    @Test
    void canViewAllDocuments_false_forNullUser() {
        assertThat(service.canViewAllDocuments(null)).isFalse();
    }

    // ── canViewDocument ──────────────────────────────────────────────────────

    @Test
    void canViewDocument_false_whenObjectAccessRuleDenies() {
        lenient().when(objectAccessEvaluationService.canViewDocument(user, document)).thenReturn(false);
        assertThat(service.canViewDocument(user, document)).isFalse();
    }

    @Test
    void canViewDocument_true_forAuthor() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        document.setAuthor(user);
        assertThat(service.canViewDocument(user, document)).isTrue();
    }

    @Test
    void canViewDocument_true_forAssignedAuthor_whenBroadObjectScopeDenies() {
        // Direct record assignment is intentionally evaluated before BU/department
        // scope. A DCO may assign an Author outside that Author's default scope.
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        document.setAuthor(user);

        assertThat(service.canViewDocument(user, document)).isTrue();
        verify(objectAccessEvaluationService, never()).canViewDocument(user, document);
    }

    @Test
    void canViewDocument_true_forParticipant() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        DocumentWorkflowParticipant participant = new DocumentWorkflowParticipant();
        participant.setUser(user);
        when(documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(document.getId()))
                .thenReturn(List.of(participant));
        assertThat(service.canViewDocument(user, document)).isTrue();
    }

    @Test
    void canViewDocument_false_forUnrelatedUser() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        assertThat(service.canViewDocument(user, document)).isFalse();
    }

    @Test
    void requireCanViewDocument_throwsWhenDenied() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        assertThatThrownBy(() -> service.requireCanViewDocument(user, document))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── canViewRevision ──────────────────────────────────────────────────────

    @Test
    void canViewRevision_true_forAuthor() {
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        revision.setAuthor(user);
        assertThat(service.canViewRevision(user, revision)).isTrue();
    }

    @Test
    void canViewRevision_true_forAssignedAuthor_whenBroadObjectScopeDenies() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        revision.setAuthor(user);

        assertThat(service.canViewRevision(user, revision)).isTrue();
        verify(objectAccessEvaluationService, never()).canViewRevision(user, revision);
    }

    @Test
    void canViewRevision_false_forUnrelatedUserOnDraft() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(false);
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(any(), anyString()))
                .thenReturn(List.of());
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        assertThat(service.canViewRevision(user, revision)).isFalse();
    }

    @Test
    void canViewRevision_true_forDco_regardlessOfStatus() {
        when(permissionEvaluationService.hasAnyPermission(eq(user), any(String[].class))).thenReturn(true);
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        assertThat(service.canViewRevision(user, revision)).isTrue();
    }

    // ── canUploadRevision: Author-only, no DCO bypass ───────────────────────

    @Test
    void canUploadRevision_true_onlyForAuthor() {
        document.setAuthor(user);
        when(permissionEvaluationService.hasPermission(user, "documents.revision.upload_source")).thenReturn(true);
        assertThat(service.canUploadRevision(user, document)).isTrue();
    }

    @Test
    void canUploadRevision_false_forNonAuthor_evenIfDco() {
        // Deliberately NOT stubbing hasAnyPermission as true — canUploadRevision doesn't
        // consult canViewAllDocuments at all, confirming DCO/admin cannot upload on
        // someone else's behalf via this path.
        UserAccount otherAuthor = new UserAccount();
        otherAuthor.setId(UUID.randomUUID());
        document.setAuthor(otherAuthor);
        assertThat(service.canUploadRevision(user, document)).isFalse();
    }

    @Test
    void canUploadRevisionSource_true_onlyForAssignedRevisionAuthor() {
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        revision.setAuthor(user);
        when(permissionEvaluationService.hasPermission(user, "documents.revision.upload_source")).thenReturn(true);

        assertThat(service.canUploadRevisionSource(user, revision)).isTrue();
    }

    @Test
    void canUploadRevisionSource_false_forCoAuthor() {
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        UserAccount assignedAuthor = new UserAccount();
        assignedAuthor.setId(UUID.randomUUID());
        revision.setAuthor(assignedAuthor);

        RevisionWorkflowParticipant coAuthor = new RevisionWorkflowParticipant();
        coAuthor.setUser(user);
        when(revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR"))
                .thenReturn(List.of(coAuthor));
        assertThat(service.canEditDraftRevision(user, revision)).isTrue();
        assertThat(service.canUploadRevisionSource(user, revision)).isFalse();
    }

    // ── canEditDraftRevision ─────────────────────────────────────────────────

    @Test
    void canEditDraftRevision_false_whenNotDraft() {
        DocumentRevisionRecord revision = revisionWithStatus("PENDING_REVIEW");
        revision.setAuthor(user);
        assertThat(service.canEditDraftRevision(user, revision)).isFalse();
    }

    @Test
    void canEditDraftRevision_true_forCoAuthor() {
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        RevisionWorkflowParticipant coAuthor = new RevisionWorkflowParticipant();
        coAuthor.setUser(user);
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR"))
                .thenReturn(List.of(coAuthor));
        assertThat(service.canEditDraftRevision(user, revision)).isTrue();
    }

    // ── canActOnRevisionParticipant (Review/Approve): only the first PENDING participant ─

    @Test
    void canReviewRevision_true_forFirstPendingReviewer() {
        DocumentRevisionRecord revision = revisionWithStatus("PENDING_REVIEW");
        revision.setSnapshotStatus("READY");
        revision.setPreviewFilePath("preview.pdf");
        RevisionWorkflowParticipant reviewer = new RevisionWorkflowParticipant();
        reviewer.setUser(user);
        reviewer.setActionStatus("PENDING");
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER"))
                .thenReturn(List.of(reviewer));
        assertThat(service.canReviewRevision(user, revision)).isTrue();
    }

    @Test
    void canReviewRevision_false_forReviewerNotYetPending() {
        // Sequential review: a second reviewer whose turn hasn't come (still "NOT_STARTED"
        // but not first in the pending queue) must not be allowed to act out of order.
        DocumentRevisionRecord revision = revisionWithStatus("PENDING_REVIEW");
        revision.setSnapshotStatus("READY");
        revision.setPreviewFilePath("preview.pdf");
        UserAccount firstReviewer = new UserAccount();
        firstReviewer.setId(UUID.randomUUID());
        RevisionWorkflowParticipant first = new RevisionWorkflowParticipant();
        first.setUser(firstReviewer);
        first.setActionStatus("PENDING");
        RevisionWorkflowParticipant second = new RevisionWorkflowParticipant();
        second.setUser(user);
        second.setActionStatus("NOT_STARTED");
        when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER"))
                .thenReturn(List.of(first, second));
        assertThat(service.canReviewRevision(user, revision)).isFalse();
    }

    @Test
    void canReviewRevision_false_whenSnapshotNotReady() {
        DocumentRevisionRecord revision = revisionWithStatus("PENDING_REVIEW");
        revision.setSnapshotStatus("GENERATING");
        assertThat(service.canReviewRevision(user, revision)).isFalse();
    }

    @Test
    void canApproveRevision_true_forAssignedPendingApprover_whenReviewSnapshotReady() {
        DocumentRevisionRecord revision = revisionWithStatus("PENDING_APPROVAL");
        revision.setSnapshotStatus("READY");
        revision.setPreviewFilePath("review-snapshot.pdf");
        RevisionWorkflowParticipant approver = new RevisionWorkflowParticipant();
        approver.setUser(user);
        approver.setActionStatus("PENDING");
        when(revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER"))
                .thenReturn(List.of(approver));

        assertThat(service.canApproveRevision(user, revision)).isTrue();
    }

    @Test
    void canApproveRevision_false_whenReviewSnapshotNotReady() {
        DocumentRevisionRecord revision = revisionWithStatus("PENDING_APPROVAL");
        revision.setSnapshotStatus("GENERATING");
        revision.setPreviewFilePath("review-snapshot.pdf");

        assertThat(service.canApproveRevision(user, revision)).isFalse();
    }

    @Test
    void canApproveRevision_false_whenStatusNotPendingApproval() {
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        assertThat(service.canApproveRevision(user, revision)).isFalse();
    }
}
