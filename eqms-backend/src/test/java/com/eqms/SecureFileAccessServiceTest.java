package com.eqms;

import com.eqms.dto.security.FileAccessContext;
import com.eqms.dto.security.FileAccessDecision;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.exception.FileAccessDeniedException;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecureFileAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SecureFileAccessServiceTest {

    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock EffectivePermissionService effectivePermissionService;
    @Mock AuditTrailService auditTrailService;
    @Mock RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock DocumentAuthorizationService documentAuthorizationService;

    @InjectMocks SecureFileAccessService service;

    private UserAccount user;
    private UUID objectId;
    private UUID userId;
    private UUID revisionId;

    @BeforeEach
    void setup() {
        userId = UUID.randomUUID();
        revisionId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        user.setUsername("testuser");
        user.setStatus(UserStatus.Active);
        objectId = UUID.randomUUID();
        lenient().doNothing().when(auditTrailService).logAs(any(), any(), any(), any(), any(), any(), any(), any());
        lenient().when(revisionWorkflowParticipantRepository
                .findByRevision_IdAndParticipantTypeAndUser_Id(any(), eq("CO_AUTHOR"), any()))
                .thenReturn(Optional.empty());
    }

    // helpers

    private EffectivePermissionResult notSuperAdmin() {
        return new EffectivePermissionResult(userId, Set.of(), List.of(), List.of(), false, false);
    }

    private EffectivePermissionResult superAdmin() {
        return new EffectivePermissionResult(userId, Set.of("*"), List.of("SYSTEM_SUPER_ADMIN"), List.of(), true, false);
    }

    private void grantPermission(String code) {
        when(permissionEvaluationService.hasPermission(eq(user), eq(code))).thenReturn(true);
    }

    private void denyPermission(String code) {
        when(permissionEvaluationService.hasPermission(eq(user), eq(code))).thenReturn(false);
    }

    private FileAccessContext draftRevisionCtx() {
        return FileAccessContext.simple("DOCUMENTS", "DRAFT");
    }

    private FileAccessContext draftCtxAsAuthor() {
        return new FileAccessContext("DOCUMENTS", "DRAFT", null, null,
                Map.of("sourceLocked", false, "editingStatus", "IN_PROGRESS",
                        "authorId", userId.toString(), "revisionId", revisionId.toString()));
    }

    private FileAccessContext draftCtxOtherAuthor() {
        return new FileAccessContext("DOCUMENTS", "DRAFT", null, null,
                Map.of("sourceLocked", false, "editingStatus", "IN_PROGRESS",
                        "authorId", UUID.randomUUID().toString(), "revisionId", revisionId.toString()));
    }

    private FileAccessContext draftRevisionCtxLocked() {
        return new FileAccessContext("DOCUMENTS", "DRAFT", null, null,
                Map.of("sourceLocked", true, "editingStatus", "IN_PROGRESS"));
    }

    private FileAccessContext draftRevisionCtxEditingCompleted() {
        return new FileAccessContext("DOCUMENTS", "DRAFT", null, null,
                Map.of("sourceLocked", false, "editingStatus", "COMPLETED"));
    }

    private FileAccessContext nonDraftRevisionCtx() {
        return FileAccessContext.simple("DOCUMENTS", "PENDING_REVIEW");
    }

    private FileAccessContext pendingReviewCtx() {
        return FileAccessContext.simple("DOCUMENTS", "PENDING_REVIEW");
    }

    private FileAccessContext effectiveCtx() {
        return FileAccessContext.simple("DOCUMENTS", "EFFECTIVE");
    }

    private FileAccessContext ccActiveNoDownload() {
        return new FileAccessContext("CONTROLLED_COPY", "DISTRIBUTED", null, null,
                Map.of("isActive", true, "policyAllowsDownload", false, "policyAllowsPortalView", true,
                        "statusCode", "DISTRIBUTED"));
    }

    private FileAccessContext ccActiveNoPortalView() {
        return new FileAccessContext("CONTROLLED_COPY", "DISTRIBUTED", null, null,
                Map.of("isActive", true, "policyAllowsDownload", true, "policyAllowsPortalView", false,
                        "statusCode", "DISTRIBUTED"));
    }

    private FileAccessContext ccInactive() {
        return new FileAccessContext("CONTROLLED_COPY", "OBSOLETED", null, null,
                Map.of("isActive", false, "policyAllowsDownload", true, "policyAllowsPortalView", true,
                        "statusCode", "OBSOLETED"));
    }

    // TC-01
    @Test
    void draftRevision_editOnline_notLocked_notCompleted_allowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtx());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-02
    @Test
    void draftRevision_sourceLocked_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtxLocked());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("SOURCE_LOCKED");
    }

    // TC-03
    @Test
    void draftRevision_editingCompleted_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtxEditingCompleted());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("EDITING_COMPLETED");
    }

    // TC-04
    @Test
    void nonDraftRevision_editOnline_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, nonDraftRevisionCtx());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("INVALID_REVISION_STATUS");
    }

    // TC-05
    @Test
    void pendingReview_reviewSnapshot_preview_allowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.preview");
        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, objectId, pendingReviewCtx());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-06
    @Test
    void effectiveRevision_publishedPdf_preview_allowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.document.preview_published");
        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.PUBLISHED_PDF, objectId, effectiveCtx());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-07
    @Test
    void draftRevision_publishedPdf_preview_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.document.preview_published");
        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.PUBLISHED_PDF, objectId, draftRevisionCtx());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("INVALID_REVISION_STATUS");
    }

    // TC-08
    @Test
    void controlledCopy_download_policyDisallows_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.controlled_copy.download_file");
        FileAccessDecision decision = service.check(user, FileAccessAction.DOWNLOAD,
                FileObjectType.CONTROLLED_COPY, objectId, ccActiveNoDownload());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("DOWNLOAD_NOT_PERMITTED");
    }

    // TC-09
    @Test
    void controlledCopy_view_portalViewDisallowed_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.controlled_copy.view_file");
        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.CONTROLLED_COPY, objectId, ccActiveNoPortalView());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("PORTAL_VIEW_NOT_PERMITTED");
    }

    // TC-10
    @Test
    void controlledCopy_inactive_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.controlled_copy.view_file");
        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.CONTROLLED_COPY, objectId, ccInactive());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("CONTROLLED_COPY_NOT_AVAILABLE");
    }

    // TC-11
    @Test
    void missingPermission_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        denyPermission("documents.revision.edit_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtx());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("MISSING_PERMISSION");
        assertThat(decision.permissionCode()).isEqualTo("documents.revision.edit_online");
    }

    // TC-12
    @Test
    void superAdmin_withoutExplicitPermission_isDenied() {
        // Super admin bypasses PERMISSION entitlement only — state/business-rule
        // checks still apply. EDIT_ONLINE on a non-draft revision must still be
        // denied for a super admin, exactly as for any other user.
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(superAdmin());
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, nonDraftRevisionCtx());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("MISSING_PERMISSION");
    }

    // TC-12b: super admin DOES bypass the permission check itself (no permission granted,
    // but state is valid) — this is the part of super-admin bypass that must still work.
    @Test
    void superAdmin_withExplicitPermissionAndValidState_isAllowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(superAdmin());
        grantPermission("documents.revision.edit_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtx());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-13
    @Test
    void require_throwsOnDeny() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        denyPermission("documents.revision.edit_online");
        assertThatThrownBy(() ->
                service.require(user, FileAccessAction.EDIT_ONLINE, FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtx())
        ).isInstanceOf(FileAccessDeniedException.class)
                .satisfies(ex -> assertThat(((FileAccessDeniedException) ex).getReasonCode()).isEqualTo("MISSING_PERMISSION"));
    }

    // TC-14
    @Test
    void require_noThrowOnAllow() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        service.require(user, FileAccessAction.EDIT_ONLINE, FileObjectType.SOURCE_DOCX, objectId, draftRevisionCtx());
    }

    // TC-15: Co-Author + Draft + unlocked + edit_online permission -> ALLOWED
    @Test
    void coAuthor_editOnline_draftUnlocked_allowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        RevisionWorkflowParticipant p = new RevisionWorkflowParticipant();
        when(revisionWorkflowParticipantRepository
                .findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, "CO_AUTHOR", userId))
                .thenReturn(Optional.of(p));
        lenient().when(permissionEvaluationService.hasAnyPermission(eq(user), any()))
                .thenReturn(false);
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-16: Non-author + SYNC_TO_OFFICE + no upload_office_online permission -> DENIED MISSING_PERMISSION (permission check fires first)
    @Test
    void nonAuthor_syncToOffice_missingPermission_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_TO_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("MISSING_PERMISSION");
        assertThat(decision.permissionCode()).isEqualTo("documents.revision.upload_office_online");
    }

    // TC-17: Non-author + SYNC_FROM_OFFICE + no upload_office_online permission -> DENIED MISSING_PERMISSION
    @Test
    void nonAuthor_syncFromOffice_missingPermission_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_FROM_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("MISSING_PERMISSION");
        assertThat(decision.permissionCode()).isEqualTo("documents.revision.upload_office_online");
    }

    // TC-18: Co-Author + VIEW_PREVIEW on REVIEW_SNAPSHOT -> ALLOWED
    @Test
    void coAuthor_viewPreview_reviewSnapshot_allowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.preview");
        FileAccessDecision decision = service.check(user, FileAccessAction.VIEW_PREVIEW,
                FileObjectType.REVIEW_SNAPSHOT, objectId, pendingReviewCtx());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-19: Non-assigned user + EDIT_ONLINE with author context -> DENIED NOT_AUTHOR_OR_COAUTHOR
    @Test
    void nonAssignedUser_editOnline_withAuthorContext_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.edit_online");
        lenient().when(permissionEvaluationService.hasAnyPermission(eq(user), any()))
                .thenReturn(false);
        FileAccessDecision decision = service.check(user, FileAccessAction.EDIT_ONLINE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("NOT_AUTHOR_OR_COAUTHOR");
    }

    // TC-20: Revision Author + upload_office_online permission + SYNC_TO_OFFICE -> ALLOWED
    @Test
    void author_syncToOffice_withPermission_allowed() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.upload_office_online");
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_TO_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxAsAuthor());
        assertThat(decision.allowed()).isTrue();
    }

    // TC-21: Author WITHOUT upload_office_online permission -> DENIED MISSING_PERMISSION
    @Test
    void author_syncToOffice_missingPermission_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_TO_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxAsAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("MISSING_PERMISSION");
        assertThat(decision.permissionCode()).isEqualTo("documents.revision.upload_office_online");
    }

    // TC-22: Any user (co-author or not) with no upload_office_online permission -> DENIED MISSING_PERMISSION (permission gated before identity)
    @Test
    void coAuthor_syncToOffice_noSyncOfficePerm_missingPermission() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_TO_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("MISSING_PERMISSION");
        assertThat(decision.permissionCode()).isEqualTo("documents.revision.upload_office_online");
    }

    // TC-23: Assigned Co-Author accidentally granted upload_office_online -> DENIED NOT_ALLOWED_FOR_COAUTHOR
    @Test
    void coAuthor_syncToOffice_accidentalSyncPerm_identityDenied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.upload_office_online");
        lenient().when(permissionEvaluationService.hasAnyPermission(eq(user), any()))
                .thenReturn(false);
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_TO_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("NOT_REVISION_AUTHOR");
    }

    // TC-24: workspace administration does not replace the Author assignment.
    @Test
    void dcoAdmin_syncToOffice_withoutAuthorAssignment_denied() {
        when(effectivePermissionService.getEffectivePermissionResult(user)).thenReturn(notSuperAdmin());
        grantPermission("documents.revision.upload_office_online");
        when(documentAuthorizationService.canViewAllDocuments(user)).thenReturn(true);
        FileAccessDecision decision = service.check(user, FileAccessAction.SYNC_TO_OFFICE,
                FileObjectType.SOURCE_DOCX, objectId, draftCtxOtherAuthor());
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("NOT_REVISION_AUTHOR");
    }
}
