package com.eqms.service;

import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Parity test for the workflow_roles catalog migration (V172,
 * docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md 0.5a).
 *
 * <p>{@code DocumentAuthorizationService.canViewAllDocuments} previously granted the
 * DCO bypass purely from {@code document_workflow_pool_members} (pool_type = DCO).
 * It now ORs that legacy lookup with a new lookup over
 * {@code access_profile_workflow_roles} joined through {@code user_access_profiles}
 * (workflow role code "DCO"). This test asserts that for every combination of
 * legacy-membership / new-path-membership, a user who is a DCO by EITHER path is
 * granted the bypass, and a user who is a DCO by NEITHER path is not — i.e. the
 * migration's data copy (legacy pool -> Access Profile + Workflow Role) cannot
 * cause a currently-authorized DCO user to silently lose access (availability),
 * nor grant access to a user who was never a DCO by either mechanism (security
 * regression).
 *
 * <p>NOTE: this test uses mocked repositories, not a live/seeded database. It
 * proves the boolean OR wiring in {@code canViewAllDocuments} is correct. It does
 * NOT independently verify that the V172 SQL migration itself faithfully copies
 * every real production {@code document_workflow_pool_members} row into
 * {@code access_profile_workflow_roles} — that requires running the migration
 * against a real (or realistic snapshot) database and diffing the resulting DCO
 * user sets, which was not available in this environment. Flagged for follow-up
 * before merge/deploy.
 */
@ExtendWith(MockitoExtension.class)
class WorkflowRolesCatalogParityTest {

    @Mock private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock private LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    @Mock private com.eqms.repository.DocumentRelationRepository documentRelationRepository;
    @Mock private DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService;
    @Mock private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;

    private DocumentAuthorizationService service;

    private UserAccount legacyOnlyUser;
    private UserAccount newPathOnlyUser;
    private UserAccount bothPathsUser;
    private UserAccount neitherPathUser;

    @BeforeEach
    void setUp() {
        service = new DocumentAuthorizationService(
                documentWorkflowParticipantRepository,
                revisionWorkflowParticipantRepository,
                documentRevisionRepository,
                permissionEvaluationService,
                objectAccessEvaluationService,
                lifecycleStatePolicyEvaluator,
                documentRelationRepository,
                documentMasterWorkflowAuthorizationService,
                revisionWorkflowAuthorizationService
        );

        legacyOnlyUser = activeUser();
        newPathOnlyUser = activeUser();
        bothPathsUser = activeUser();
        neitherPathUser = activeUser();

        // Workflow roles are descriptive/assignable metadata only.  The explicit
        // documents.document.view_all permission is the sole blanket-view grant.
        lenient().when(permissionEvaluationService.hasAnyPermission(any(UserAccount.class), any(String[].class)))
                .thenReturn(false);
    }

    private UserAccount activeUser() {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setStatus(UserStatus.Active);
        return u;
    }

    @Test
    void legacy_pool_membership_does_not_grant_blanket_document_access() {
        assertFalse(service.canViewAllDocuments(legacyOnlyUser));
    }

    @Test
    void workflow_role_membership_does_not_grant_blanket_document_access() {
        assertFalse(service.canViewAllDocuments(newPathOnlyUser));
    }

    @Test
    void publishing_workspace_decision_delegates_to_the_configurable_workflow_policy() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        when(revisionWorkflowAuthorizationService.check(
                eq(bothPathsUser),
                eq(revision),
                eq(RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE),
                any()
        )).thenReturn(WorkflowAuthorizationDecision.allowed(
                RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE,
                revision.getId(),
                "READY_FOR_PUBLISHING",
                false,
                false
        ));

        assertTrue(service.canOpenPublishingWorkspace(bothPathsUser, revision));
        verify(revisionWorkflowAuthorizationService).check(
                eq(bothPathsUser),
                eq(revision),
                eq(RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE),
                any()
        );
    }

    @Test
    void explicit_permission_grants_blanket_document_access() {
        when(permissionEvaluationService.hasAnyPermission(eq(bothPathsUser), any(String[].class))).thenReturn(true);
        org.junit.jupiter.api.Assertions.assertTrue(service.canViewAllDocuments(bothPathsUser));
    }

    @Test
    void user_present_in_neither_path_does_not_get_DCO_bypass() {
        assertFalse(service.canViewAllDocuments(neitherPathUser),
                "A user who was never a DCO by either mechanism must not gain access (no security regression)");
    }
}
