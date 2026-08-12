package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.WorkflowActionPolicyController;
import com.eqms.dto.security.*;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.WorkflowActorType;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.WorkflowActionPolicyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Sprint 5 Patch 1 — lightweight unit tests verifying that every
 * WorkflowActionPolicyController endpoint calls the correct permission guard.
 *
 * Strategy: call controller methods directly with mocked dependencies.
 * - requireView()  → throws AccessDeniedException when view permission absent
 * - requireManage() → throws AccessDeniedException when manage permission absent
 *
 * No Spring context / MockMvc needed — the controller is a plain Java class.
 */
@ExtendWith(MockitoExtension.class)
class WorkflowActionPolicyControllerSecurityTest {

    @Mock WorkflowActionPolicyService policyService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock CurrentUserService currentUserService;

    WorkflowActionPolicyController controller;

    UserAccount noPermUser;
    UserAccount viewUser;
    UserAccount manageUser;
    UUID anyId = UUID.randomUUID();

    static final String VIEW_PERM   = "security.workflow_authorization.view";
    static final String MANAGE_PERM = "security.workflow_authorization.manage";

    @BeforeEach
    void setUp() {
        controller = new WorkflowActionPolicyController(
                policyService, permissionEvaluationService, currentUserService);

        noPermUser = user("no-perm");
        viewUser   = user("view-only");
        manageUser = user("manage");
    }

    private UserAccount user(String name) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setStatus(UserStatus.Active);
        return u;
    }

    /** Grant only view permission to viewUser. */
    private void setupViewUser() {
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(viewUser);
        lenient().when(permissionEvaluationService.hasPermission(viewUser, VIEW_PERM)).thenReturn(true);
        lenient().when(permissionEvaluationService.hasPermission(viewUser, MANAGE_PERM)).thenReturn(false);
    }

    /** Grant manage (and implicitly view) permission to manageUser. */
    private void setupManageUser() {
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(manageUser);
        lenient().when(permissionEvaluationService.hasPermission(manageUser, VIEW_PERM)).thenReturn(true);
        lenient().when(permissionEvaluationService.hasPermission(manageUser, MANAGE_PERM)).thenReturn(true);
    }

    /** User with no permissions. */
    private void setupNoPermUser() {
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(noPermUser);
        lenient().when(permissionEvaluationService.hasPermission(noPermUser, VIEW_PERM)).thenReturn(false);
        lenient().when(permissionEvaluationService.hasPermission(noPermUser, MANAGE_PERM)).thenReturn(false);
    }

    // ── READ-ONLY endpoints — must require VIEW ────────────────────────────────

    // GET /  (listAll)
    @Test
    void listAll_withoutViewPermission_throws403() {
        setupNoPermUser();
        assertThatThrownBy(() -> controller.listAll())
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void listAll_withViewPermission_reaches200() {
        setupViewUser();
        when(policyService.listAll()).thenReturn(List.of());
        assertThat(controller.listAll().getStatusCode().value()).isEqualTo(200);
    }

    // GET /{id}
    @Test
    void getById_withoutViewPermission_throws403() {
        setupNoPermUser();
        assertThatThrownBy(() -> controller.getById(anyId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getById_withViewPermission_reaches200() {
        setupViewUser();
        when(policyService.getById(anyId)).thenReturn(null);
        assertThat(controller.getById(anyId).getStatusCode().value()).isEqualTo(200);
    }

    // GET /defaults/document-revision
    @Test
    void getSystemDefaults_withoutViewPermission_throws403() {
        setupNoPermUser();
        assertThatThrownBy(() -> controller.getSystemDefaults())
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getSystemDefaults_withViewPermission_reaches200() {
        setupViewUser();
        when(policyService.getDefaultDocumentRevisionPolicies()).thenReturn(List.of());
        assertThat(controller.getSystemDefaults().getStatusCode().value()).isEqualTo(200);
    }

    // GET /effective
    @Test
    void getEffective_withoutViewPermission_throws403() {
        setupNoPermUser();
        assertThatThrownBy(() -> controller.getEffective(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "SUBMIT_FOR_REVIEW", "DRAFT", null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getEffective_withViewPermission_reaches200() {
        setupViewUser();
        when(policyService.getEffectivePolicy(any(), any(), any(), any(), any(), any()))
                .thenReturn(new WorkflowActionPolicyEffectiveResponse("FALLBACK", null, true));
        assertThat(controller.getEffective(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "SUBMIT_FOR_REVIEW", "DRAFT", null).getStatusCode().value()).isEqualTo(200);
    }

    // GET /options
    @Test
    void getOptions_withoutViewPermission_throws403() {
        setupNoPermUser();
        assertThatThrownBy(() -> controller.getOptions())
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getOptions_withViewPermission_reaches200() {
        setupViewUser();
        when(policyService.getOptions()).thenReturn(
                new WorkflowActionPolicyOptionsResponse(
                        List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), java.util.Map.of()));
        assertThat(controller.getOptions().getStatusCode().value()).isEqualTo(200);
    }

    // POST /{id}/preview-update  (read-only semantics — requires VIEW only)
    @Test
    void previewUpdate_withoutViewPermission_throws403() {
        setupNoPermUser();
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        assertThatThrownBy(() -> controller.previewUpdate(anyId, req))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void previewUpdate_withViewPermission_reaches200() {
        setupViewUser();
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        when(policyService.previewUpdate(eq(anyId), any()))
                .thenReturn(new WorkflowActionPolicyPreviewResponse(
                        true, anyId, List.of(), List.of(),
                        new WorkflowActionPolicyPreviewResponse.WouldAffect(
                                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "SUBMIT_FOR_REVIEW", "DRAFT", null)));
        assertThat(controller.previewUpdate(anyId, req).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void previewUpdate_withManagePermission_alsoAllowed() {
        // manage implies view — preview must also work for manage users
        setupManageUser();
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        when(policyService.previewUpdate(eq(anyId), any()))
                .thenReturn(new WorkflowActionPolicyPreviewResponse(
                        true, anyId, List.of(), List.of(),
                        new WorkflowActionPolicyPreviewResponse.WouldAffect(
                                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "SUBMIT_FOR_REVIEW", "DRAFT", null)));
        assertThat(controller.previewUpdate(anyId, req).getStatusCode().value()).isEqualTo(200);
    }

    // ── MUTATION endpoints — must require MANAGE ───────────────────────────────

    // POST /  (createPolicy)
    @Test
    void createPolicy_withoutManagePermission_throws403() {
        setupViewUser(); // has VIEW but not MANAGE
        WorkflowActionPolicyCreateRequest req = new WorkflowActionPolicyCreateRequest(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "SUBMIT_FOR_REVIEW", "DRAFT", null,
                "documents.revision.submit_review", 100, true, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        assertThatThrownBy(() -> controller.createPolicy(req))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).createPolicy(any(), any());
    }

    @Test
    void createPolicy_withManagePermission_reachesService() {
        setupManageUser();
        WorkflowActionPolicyCreateRequest req = new WorkflowActionPolicyCreateRequest(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "SUBMIT_FOR_REVIEW", "DRAFT", null,
                "documents.revision.submit_review", 100, true, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        when(policyService.createPolicy(any(), any())).thenReturn(null);
        // 201 is returned, null body is acceptable for this guard test
        controller.createPolicy(req);
        verify(policyService).createPolicy(eq(req), eq(manageUser));
    }

    // PUT /{id}  (updatePolicy)
    @Test
    void updatePolicy_withoutManagePermission_throws403() {
        setupViewUser();
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        assertThatThrownBy(() -> controller.updatePolicy(anyId, req))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).updatePolicy(any(), any(), any());
    }

    @Test
    void updatePolicy_withManagePermission_reachesService() {
        setupManageUser();
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        when(policyService.updatePolicy(eq(anyId), any(), any())).thenReturn(null);
        controller.updatePolicy(anyId, req);
        verify(policyService).updatePolicy(eq(anyId), eq(req), eq(manageUser));
    }

    // POST /{id}/create-document-type-override
    @Test
    void createDocumentTypeOverride_withoutManagePermission_throws403() {
        setupViewUser();
        WorkflowActionPolicyOverrideRequest req = new WorkflowActionPolicyOverrideRequest(
                UUID.randomUUID(), null, null, null, null, null);
        assertThatThrownBy(() -> controller.createDocumentTypeOverride(anyId, req))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).createDocumentTypeOverride(any(), any(), any());
    }

    @Test
    void createDocumentTypeOverride_withManagePermission_reachesService() {
        setupManageUser();
        WorkflowActionPolicyOverrideRequest req = new WorkflowActionPolicyOverrideRequest(
                UUID.randomUUID(), null, null, null, null, null);
        when(policyService.createDocumentTypeOverride(any(), any(), any())).thenReturn(null);
        controller.createDocumentTypeOverride(anyId, req);
        verify(policyService).createDocumentTypeOverride(eq(anyId), eq(req), eq(manageUser));
    }

    // POST /{id}/duplicate
    @Test
    void duplicatePolicy_withoutManagePermission_throws403() {
        setupViewUser();
        assertThatThrownBy(() -> controller.duplicatePolicy(anyId, null))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).duplicatePolicy(any(), any(), any());
    }

    @Test
    void duplicatePolicy_withManagePermission_reachesService() {
        setupManageUser();
        when(policyService.duplicatePolicy(any(), any(), any())).thenReturn(null);
        controller.duplicatePolicy(anyId, null);
        verify(policyService).duplicatePolicy(eq(anyId), any(), eq(manageUser));
    }

    // POST /{id}/reset-default
    @Test
    void resetToDefault_withoutManagePermission_throws403() {
        setupViewUser();
        assertThatThrownBy(() -> controller.resetToDefault(anyId, null))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).resetToSystemDefault(any(), any(), any(), any());
    }

    @Test
    void resetToDefault_withManagePermission_reachesService() {
        setupManageUser();
        when(policyService.resetToSystemDefault(any(), any(), any(), any())).thenReturn(null);
        controller.resetToDefault(anyId, null);
        verify(policyService).resetToSystemDefault(eq(anyId), eq(manageUser), any(), any());
    }

    // POST /{id}/activate
    @Test
    void activate_withoutManagePermission_throws403() {
        setupViewUser();
        assertThatThrownBy(() -> controller.activate(anyId, null))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).activatePolicy(any(), any(), any());
    }

    @Test
    void activate_withManagePermission_reachesService() {
        setupManageUser();
        when(policyService.activatePolicy(any(), any(), any())).thenReturn(null);
        controller.activate(anyId, null);
        verify(policyService).activatePolicy(eq(anyId), eq(manageUser), any());
    }

    // POST /{id}/deactivate
    @Test
    void deactivate_withoutManagePermission_throws403() {
        setupViewUser();
        assertThatThrownBy(() -> controller.deactivate(anyId, null))
                .isInstanceOf(AccessDeniedException.class);
        verify(policyService, never()).deactivatePolicy(any(), any(), any());
    }

    @Test
    void deactivate_withManagePermission_reachesService() {
        setupManageUser();
        when(policyService.deactivatePolicy(any(), any(), any())).thenReturn(null);
        controller.deactivate(anyId, null);
        verify(policyService).deactivatePolicy(eq(anyId), eq(manageUser), any());
    }

    // ── View-only user cannot call any mutation endpoint ──────────────────────

    @Test
    void viewOnlyUser_cannotCreate() {
        setupViewUser();
        WorkflowActionPolicyCreateRequest req = new WorkflowActionPolicyCreateRequest(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "SUBMIT_FOR_REVIEW", "DRAFT", null,
                "documents.revision.submit_review", 100, true, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        assertThatThrownBy(() -> controller.createPolicy(req))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void viewOnlyUser_cannotActivate() {
        setupViewUser();
        assertThatThrownBy(() -> controller.activate(anyId, null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void viewOnlyUser_cannotDeactivate() {
        setupViewUser();
        assertThatThrownBy(() -> controller.deactivate(anyId, null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void viewOnlyUser_cannotUpdate() {
        setupViewUser();
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);
        assertThatThrownBy(() -> controller.updatePolicy(anyId, req))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Guard methods call currentUserService exactly once per request ─────────

    @Test
    void requireView_callsCurrentUserServiceExactlyOnce() {
        setupNoPermUser();
        try { controller.listAll(); } catch (AccessDeniedException ignored) {}
        verify(currentUserService, times(1)).requireCurrentUser();
    }

    @Test
    void requireManage_callsCurrentUserServiceExactlyOnce() {
        setupViewUser(); // has view but not manage
        try { controller.activate(anyId, null); } catch (AccessDeniedException ignored) {}
        verify(currentUserService, times(1)).requireCurrentUser();
    }

    // ── Service is never called when permission check fails ───────────────────

    @Test
    void serviceNotCalled_whenViewDenied_forReadEndpoints() {
        setupNoPermUser();
        try { controller.listAll(); } catch (AccessDeniedException ignored) {}
        try { controller.getById(anyId); } catch (AccessDeniedException ignored) {}
        try { controller.getSystemDefaults(); } catch (AccessDeniedException ignored) {}
        try { controller.getOptions(); } catch (AccessDeniedException ignored) {}

        verifyNoInteractions(policyService);
    }

    @Test
    void serviceNotCalled_whenManageDenied_forMutationEndpoints() {
        setupViewUser(); // view only — all mutations should fail before reaching service
        WorkflowActionPolicyRequest req = new WorkflowActionPolicyRequest(
                "documents.revision.submit_review", 100, true, null, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null);

        try { controller.createPolicy(new WorkflowActionPolicyCreateRequest(
                "DOCUMENT_CONTROL", "DOCUMENT_REVISION", "REVISION",
                "SUBMIT_FOR_REVIEW", "DRAFT", null,
                "documents.revision.submit_review", 100, true, null,
                List.of(new WorkflowActionPolicyActorRequest(WorkflowActorType.OWNER, null)), null));
        } catch (AccessDeniedException ignored) {}

        try { controller.updatePolicy(anyId, req); } catch (AccessDeniedException ignored) {}
        try { controller.activate(anyId, null); } catch (AccessDeniedException ignored) {}
        try { controller.deactivate(anyId, null); } catch (AccessDeniedException ignored) {}
        try { controller.resetToDefault(anyId, null); } catch (AccessDeniedException ignored) {}
        try { controller.duplicatePolicy(anyId, null); } catch (AccessDeniedException ignored) {}
        try { controller.createDocumentTypeOverride(anyId, new WorkflowActionPolicyOverrideRequest(
                UUID.randomUUID(), null, null, null, null, null));
        } catch (AccessDeniedException ignored) {}

        // previewUpdate uses VIEW, so viewUser can call it — exclude from this check
        verify(policyService, never()).createPolicy(any(), any());
        verify(policyService, never()).updatePolicy(any(), any(), any());
        verify(policyService, never()).activatePolicy(any(), any(), any());
        verify(policyService, never()).deactivatePolicy(any(), any(), any());
        verify(policyService, never()).resetToSystemDefault(any(), any(), any(), any());
        verify(policyService, never()).duplicatePolicy(any(), any(), any());
        verify(policyService, never()).createDocumentTypeOverride(any(), any(), any());
    }
}
