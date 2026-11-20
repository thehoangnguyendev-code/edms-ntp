package com.eqms;

import com.eqms.dto.security.FileAccessContext;
import com.eqms.dto.security.FileAccessDecision;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecureFileAccessService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Record visibility (Decision DOC-VISIBILITY-2026-10-06, VISIBILITY-TIERS-2026-11-20): only people in a record's flow (or a copy's named recipient)
 * see it; the dedicated view-all permissions see everything. The system-wide "all holders of the view permission" mode was removed; the department
 * level is covered by DocumentDepartmentVisibilityTest and the copies by CopyFlowVisibilityTest.
 */
@ExtendWith(MockitoExtension.class)
class RecordVisibilityModeTest {

    private static final String VIEW = "documents.document.view";
    private static final String VIEW_ALL = "documents.document.view_all";
    private static final String CC_VIEW = "documents.controlled_copy.view";
    private static final String CC_VIEW_ALL = "documents.controlled_copy.view_all";
    private static final String UC_VIEW = "documents.uncontrolled_copy.view";
    private static final String UC_VIEW_ALL = "documents.uncontrolled_copy.view_all";

    // ── DocumentAuthorizationService fixture ─────────────────────────────────
    @Mock DocumentWorkflowParticipantRepository documentParticipantRepository;
    @Mock RevisionWorkflowParticipantRepository revisionParticipantRepository;
    @Mock DocumentRevisionRepository documentRevisionRepository;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock SystemConfigurationService systemConfigurationService;

    @InjectMocks DocumentAuthorizationService documentAuthorizationService;

    // ── SecureFileAccessService fixture ──────────────────────────────────────
    @Mock EffectivePermissionService effectivePermissionService;
    @Mock AuditTrailService auditTrailService;

    private UserAccount user;
    private UUID userId;
    private UUID revisionId;

    @BeforeEach
    void setup() {
        userId = UUID.randomUUID();
        revisionId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        user.setUsername("staff");
        user.setFullName("Staff Member");
        user.setStatus(UserStatus.Active);

        lenient().when(documentParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(any())).thenReturn(List.of());
        lenient().when(revisionParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(any(), any()))
                .thenReturn(List.of());
        lenient().when(revisionParticipantRepository.countByRevision_Document_IdAndUser_Id(any(), any())).thenReturn(0L);
        lenient().when(systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes()).thenReturn(Set.of());
    }

    private void grant(String... codes) {
        for (String code : codes) {
            lenient().when(permissionEvaluationService.hasPermission(user, code)).thenReturn(true);
        }
    }

    private DocumentRevisionRecord revisionWithStatus(String statusCode) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        ReflectionTestUtils.setField(revision, "id", revisionId);
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode(statusCode);
        revision.setStatus(status);
        return revision;
    }

    private DocumentRecord documentWithId() {
        DocumentRecord document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", UUID.randomUUID());
        return document;
    }

    private ControlledCopyRecord copyFor(UserAccount recipient, String recipientName) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setRecipientUser(recipient);
        copy.setRecipientName(recipientName);
        return copy;
    }

    // ── Document / Revision: participants only ───────────────────────────────

    @Test
    void participantsOnly_viewPermissionAloneNeverShowsAnyStatus() {
        grant(VIEW);

        for (String status : List.of("DRAFT", "PENDING_REVIEW", "EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED")) {
            assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus(status)))
                    .as("revision in %s", status).isFalse();
        }
        assertThat(documentAuthorizationService.canViewDocument(user, documentWithId())).isFalse();
        assertThat(documentAuthorizationService.canListAllDocuments(user)).isFalse();
    }

    @Test
    void participantsOnly_authorOfRevisionSeesItWithoutViewPermission() {
        DocumentRevisionRecord revision = revisionWithStatus("DRAFT");
        revision.setAuthor(user);

        assertThat(documentAuthorizationService.canViewRevision(user, revision)).isTrue();
    }

    // ── Blanket permission ───────────────────────────────────────────────────

    @Test
    void viewAllPermissionSeesEverything() {
        grant(VIEW_ALL);
        assertThat(documentAuthorizationService.canViewAllDocuments(user)).isTrue();
        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("DRAFT"))).isTrue();
        assertThat(documentAuthorizationService.canViewDocument(user, documentWithId())).isTrue();
        assertThat(documentAuthorizationService.canListAllDocuments(user)).isTrue();
    }

    @Test
    void administrationPermissionsNoLongerImplyViewAll() {
        grant("documents.admin.view", "documents.admin.manage_workflow_roles", "security.sod.manage", VIEW);
        lenient().when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(true);

        assertThat(documentAuthorizationService.canViewAllDocuments(user)).isFalse();
        assertThat(documentAuthorizationService.canViewRevision(user, revisionWithStatus("EFFECTIVE"))).isFalse();
    }

    // ── Controlled Copy ──────────────────────────────────────────────────────

    @Test
    void controlledCopy_namedRecipientSeesItInParticipantsOnlyMode() {

        assertThat(documentAuthorizationService.canViewControlledCopy(user, copyFor(user, "Staff Member"))).isTrue();
    }

    @Test
    void controlledCopy_nonRecipientDoesNotSeeItEvenWithMatchingDisplayName() {
        UserAccount other = new UserAccount();
        other.setId(UUID.randomUUID());
        // Same display text as the signed-in user, different account: must not match.
        ControlledCopyRecord copy = copyFor(other, "Staff Member");
        copy.setRequestedBy(user);
        grant(VIEW, CC_VIEW);

        assertThat(documentAuthorizationService.canViewControlledCopy(user, copy)).isFalse();
    }

    @Test
    void controlledCopy_documentParticipantIsNotARecipient() {
        UserAccount other = new UserAccount();
        other.setId(UUID.randomUUID());
        ControlledCopyRecord copy = copyFor(other, "Someone Else");
        copy.setRevision(revisionWithStatus("EFFECTIVE"));
        copy.getRevision().setAuthor(user);

        assertThat(documentAuthorizationService.canViewControlledCopy(user, copy)).isFalse();
    }

    @Test
    void controlledCopy_viewAllPermissionSeesAllCopiesAndBatches() {
        grant(CC_VIEW_ALL);
        UserAccount other = new UserAccount();
        other.setId(UUID.randomUUID());

        assertThat(documentAuthorizationService.canViewControlledCopy(user, copyFor(other, "Someone Else"))).isTrue();
        assertThat(documentAuthorizationService.canViewControlledCopyBatch(user)).isTrue();
    }

    @Test
    void controlledCopy_batchIsHiddenFromARecipientWithoutBlanketPermission() {
        grant(CC_VIEW);

        assertThat(documentAuthorizationService.canViewControlledCopyBatch(user)).isFalse();
    }

    @Test
    void controlledCopy_documentViewAllDoesNotImplyCopyViewAll() {
        grant(VIEW_ALL);

        assertThat(documentAuthorizationService.canViewAllControlledCopies(user)).isFalse();
        assertThat(documentAuthorizationService.canViewAllUncontrolledCopies(user)).isFalse();
    }

    // ── Uncontrolled Copy ────────────────────────────────────────────────────

    @Test
    void uncontrolledCopy_blanketViewNeedsTheDedicatedPermission() {
        grant(UC_VIEW);
        assertThat(documentAuthorizationService.canViewAllUncontrolledCopies(user)).isFalse();

        grant(UC_VIEW_ALL);
        assertThat(documentAuthorizationService.canViewAllUncontrolledCopies(user)).isTrue();
    }

    // ── SecureFileAccessService review snapshot ──────────────────────────────

    private SecureFileAccessService fileAccessService() {
        SecureFileAccessService service = new SecureFileAccessService(
                permissionEvaluationService, effectivePermissionService, auditTrailService,
                revisionParticipantRepository, null, documentAuthorizationService);
        EffectivePermissionResult effective = new EffectivePermissionResult(
                userId, Set.of("documents.revision.preview"), List.of(), List.of(), false, false);
        lenient().when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(effective);
        lenient().when(permissionEvaluationService.hasPermission(eq(user), any())).thenReturn(true);
        // The generic stub above must not turn the user into a blanket viewer.
        lenient().when(permissionEvaluationService.hasPermission(user, VIEW_ALL)).thenReturn(false);
        return service;
    }

    private FileAccessContext snapshotContext(String status, UUID authorId) {
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("revisionId", revisionId.toString());
        if (authorId != null) {
            attrs.put("authorId", authorId.toString());
        }
        return new FileAccessContext("DOCUMENTS", status, null, null, attrs);
    }

    @Test
    void participantsOnly_snapshotPreview_deniedForNonParticipant() {
        SecureFileAccessService service = fileAccessService();
        when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(0L);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", UUID.randomUUID()));

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("NOT_ASSIGNED_PARTICIPANT");
    }

    @Test
    void participantsOnly_snapshotPreview_allowedForAssignedParticipant() {
        SecureFileAccessService service = fileAccessService();
        when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(1L);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", UUID.randomUUID()));

        assertThat(decision.allowed()).isTrue();
    }

    @Test
    void participantsOnly_snapshotPreview_allowedForAuthor() {
        SecureFileAccessService service = fileAccessService();
        lenient().when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(0L);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", userId));

        assertThat(decision.allowed()).isTrue();
    }

    @Test
    void departmentLevel_doesNotOpenTheInFlightReviewSnapshot() {
        // the department level is read-only: a person of the department who is not in the flow does not read the content under review
        grant("documents.document.view_department", "documents.document.view");
        SecureFileAccessService service = fileAccessService();
        when(revisionParticipantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(0L);

        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, revisionId, snapshotContext("PENDING_REVIEW", UUID.randomUUID()));

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("NOT_ASSIGNED_PARTICIPANT");
    }
}
