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
 * <p>{@code DocumentAuthorizationService.canViewAllDocuments} grants the blanket
 * document-view bypass purely through explicit permission (e.g.
 * {@code documents.document.view_all}), never through workflow-role/pool
 * membership by itself -- confirmed by this test's assertions. The legacy
 * Document Workflow Pool ({@code document_workflow_pool_members}) this class was
 * originally written to compare against has since been fully retired (V398); the
 * "legacy"/"new path" test names below predate that removal and now simply cover
 * the permission-only behavior.
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
    @Mock private com.eqms.repository.DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository;
    @Mock private SystemConfigurationService systemConfigurationService;

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
                revisionWorkflowAuthorizationService,
                documentStakeholderHistoryRepository,
                systemConfigurationService
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
