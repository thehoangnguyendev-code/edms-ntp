package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.dto.security.ControlledCopyAuthorizationDecision;
import com.eqms.entity.*;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.enums.WorkflowActorType;
import com.eqms.repository.*;
import com.eqms.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ControlledCopyAuthorizationServiceTest {

    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock CurrentUserService currentUserService;
    @Mock DocumentAuthorizationService documentAuthorizationService;
    @Mock ControlledCopyPolicyService controlledCopyPolicyService;
    @Mock SecureFileAccessService secureFileAccessService;
    @Mock ControlledCopyRepository controlledCopyRepository;
    @Mock ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Mock WorkflowActionPolicyRepository workflowActionPolicyRepository;
    @Mock UserAccessProfileRepository userAccessProfileRepository;
    @Mock AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository;
    @Mock DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
    @Mock DocumentRecordRepository documentRecordRepository;
    @Mock ObjectAccessEvaluationService objectAccessEvaluationService;

    ControlledCopyAuthorizationService service;
    UserAccount user;
    DocumentRecord document;
    DocumentRevisionRecord revision;
    ControlledCopyRecord copy;
    ControlledCopyDistributionBatch batch;
    ControlledCopyPolicySetting policy;

    @BeforeEach
    void setUp() {
        service = new ControlledCopyAuthorizationService(
                permissionEvaluationService,
                currentUserService,
                documentAuthorizationService,
                controlledCopyPolicyService,
                secureFileAccessService,
                controlledCopyRepository,
                controlledCopyDistributionBatchRepository,
                workflowActionPolicyRepository,
                userAccessProfileRepository,
                accessProfileWorkflowRoleRepository,
                documentWorkflowPoolMemberRepository,
                documentRecordRepository
        );

        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        user.setFullName("Nguyen Van A");
        user.setUsername("nguyenvana");
        user.setEmail("nguyenvana@example.com");

        document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setStatus(activeDocumentStatus());

        revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        revision.setStatus(effectiveRevisionStatus());

        batch = new ControlledCopyDistributionBatch();
        batch.setId(UUID.randomUUID());
        batch.setDocument(document);
        batch.setRevision(revision);
        batch.setStatusCode("READY_FOR_DISTRIBUTION");
        batch.setStatus("Ready for Distribution");
        batch.setRequestedAt(Instant.now().minusSeconds(60));

        copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setRevision(revision);
        copy.setDistributionBatch(batch);
        copy.setStatusCode("READY_FOR_DISTRIBUTION");
        copy.setCurrentStage("Ready for Distribution");
        copy.setAccessToken("token-123");
        copy.setAccessTokenIssuedAt(Instant.now().minusSeconds(60));
        copy.setRequestedBy(user);
        copy.setRecipientUser(user);
        // Keep the shared fixture valid regardless of the calendar date on which
        // the suite runs; the dedicated expired-token test sets its own past date.
        copy.setExpiryDate(Instant.now().plusSeconds(30 * 24 * 60 * 60L));

        policy = new ControlledCopyPolicySetting();
        policy.setAllowDownload(true);
        policy.setAllowPortalView(true);

        lenient().when(controlledCopyPolicyService.loadOrDefault()).thenReturn(policy);
        lenient().when(documentAuthorizationService.canAccessControlledCopy(eq(user), any(DocumentRecord.class))).thenReturn(true);
        lenient().when(documentAuthorizationService.canAccessControlledCopy(eq(user), any(DocumentRevisionRecord.class))).thenReturn(true);
        lenient().doNothing().when(documentAuthorizationService).requireCanAccessControlledCopy(eq(user), any(DocumentRecord.class));
        lenient().doNothing().when(documentAuthorizationService).requireCanAccessControlledCopy(eq(user), any(DocumentRevisionRecord.class));
        lenient().when(secureFileAccessService.check(eq(user), any(), any(), any(), any())).thenAnswer(invocation -> com.eqms.dto.security.FileAccessDecision.allowed(
                invocation.getArgument(1),
                invocation.getArgument(2),
                invocation.getArgument(3),
                false
        ));
        lenient().when(permissionEvaluationService.isSuperAdmin(user)).thenReturn(false);
        lenient().when(permissionEvaluationService.hasPermission(eq(user), anyString())).thenReturn(true);
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(user);
    }

    @Test
    void evaluate_superAdminCannotBypassDocumentScope() {
        // REQUEST_COPY is the only action still decided by this legacy evaluator post-cutover
        // (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 3 cutover rule 5 -- no resourceId
        // exists yet at request time, so it cannot go through AuthorizationEngineService). Every
        // other action's scope/actor-matching behavior is now covered by
        // ControlledCopyResourceAdapterTest against the engine path instead.
        ControlledCopyAuthorizationService scopedService = new ControlledCopyAuthorizationService(
                permissionEvaluationService, currentUserService, documentAuthorizationService,
                controlledCopyPolicyService, secureFileAccessService, controlledCopyRepository,
                controlledCopyDistributionBatchRepository, workflowActionPolicyRepository,
                userAccessProfileRepository, accessProfileWorkflowRoleRepository,
                documentWorkflowPoolMemberRepository, documentRecordRepository, objectAccessEvaluationService
        );
        when(documentRecordRepository.findById(document.getId())).thenReturn(Optional.of(document));
        when(objectAccessEvaluationService.canAccessDocument(eq(user), eq(document), eq("VIEW"))).thenReturn(false);

        var decision = scopedService.evaluate(user, ControlledCopyWorkflowAction.REQUEST_COPY,
                ControlledCopyAuthorizationContext.forRequest(document.getId(), revision.getId(),
                        "ACTIVE", "EFFECTIVE", user.getId()));

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("OUT_OF_SCOPE");
        verify(permissionEvaluationService, never()).hasPermission(any(), any());
    }

    @Test
    void requestCopy_revisionEffective_userHasPermission_allowed() {
        when(workflowActionPolicyRepository.findActiveGlobalPolicies(eq("DOCUMENT_CONTROL"), eq("CONTROLLED_COPY"), eq("CONTROLLED_COPY"), eq("REQUEST_COPY"), eq("EFFECTIVE")))
                .thenReturn(List.of(policy("REQUEST_COPY", "EFFECTIVE", "documents.controlled_copy.request", WorkflowActorType.ACCESS_PROFILE, "QA_REVIEWER")));
        when(userAccessProfileRepository.existsByUserIdAndProfileCode(user.getId(), "QA_REVIEWER")).thenReturn(true);

        ControlledCopyAuthorizationDecision decision = service.evaluate(
                user,
                ControlledCopyWorkflowAction.REQUEST_COPY,
                ControlledCopyAuthorizationContext.forRequest(
                        document.getId(),
                        revision.getId(),
                        "ACTIVE",
                        "EFFECTIVE",
                        user.getId()
                )
        );

        assertThat(decision.allowed()).isTrue();
        assertThat(decision.requiredPermissionCode()).isEqualTo("documents.controlled_copy.request");
    }

    @Test
    void requestCopy_accessProfileWithoutExplicitCode_denied() {
        when(workflowActionPolicyRepository.findActiveGlobalPolicies(eq("DOCUMENT_CONTROL"), eq("CONTROLLED_COPY"), eq("CONTROLLED_COPY"), eq("REQUEST_COPY"), eq("EFFECTIVE")))
                .thenReturn(List.of(policy("REQUEST_COPY", "EFFECTIVE", "documents.controlled_copy.request", WorkflowActorType.ACCESS_PROFILE, null)));

        ControlledCopyAuthorizationDecision decision = service.evaluate(
                user,
                ControlledCopyWorkflowAction.REQUEST_COPY,
                ControlledCopyAuthorizationContext.forRequest(
                        document.getId(),
                        revision.getId(),
                        "ACTIVE",
                        "EFFECTIVE",
                        user.getId()
                )
        );

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");
    }

    @Test
    void requestCopy_revisionDraft_denied_REVISION_NOT_EFFECTIVE() {
        ControlledCopyAuthorizationDecision decision = service.evaluate(
                user,
                ControlledCopyWorkflowAction.REQUEST_COPY,
                ControlledCopyAuthorizationContext.forRequest(
                        document.getId(),
                        revision.getId(),
                        "ACTIVE",
                        "DRAFT",
                        user.getId()
                )
        );

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("REVISION_NOT_EFFECTIVE");
    }

    @Test
    void requestCopy_documentInactive_denied_DOCUMENT_NOT_ACTIVE() {
        ControlledCopyAuthorizationDecision decision = service.evaluate(
                user,
                ControlledCopyWorkflowAction.REQUEST_COPY,
                ControlledCopyAuthorizationContext.forRequest(
                        document.getId(),
                        revision.getId(),
                        "DRAFT",
                        "EFFECTIVE",
                        user.getId()
                )
        );

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("DOCUMENT_NOT_ACTIVE");
    }

    // Every action other than REQUEST_COPY now goes through AuthorizationEngineService (cutover
    // rule 5) -- the download/print/preview/recall/replace/report-lost actor-matching and
    // permission-gate behavior these tests used to exercise via evaluateInternal() is superseded
    // by ControlledCopyResourceAdapterTest against the engine path. The shared state/policy
    // invariants (DOWNLOAD_NOT_ALLOWED_BY_POLICY, EXPIRED, PRINT_NOT_ALLOWED_BY_POLICY,
    // INVALID_CONTROLLED_COPY_STATE, INVALID_REPLACEMENT_SOURCE) still live in
    // validateInvariants()/checkInvariantPrecondition() -- see
    // ControlledCopyInvariantPreconditionTest for that coverage.

    @Test
    void capabilityApi_isReadOnly() {
        copy.setStatusCode("DISTRIBUTED");
        copy.setCurrentStage("Distributed");
        when(controlledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));

        ControlledCopyActionCapabilitiesResponse response = service.getCopyCapabilities(copy.getId());

        assertThat(response.controlledCopyId()).isEqualTo(copy.getId());
        verify(controlledCopyRepository, never()).save(any());
        verify(controlledCopyDistributionBatchRepository, never()).save(any());
    }

    private WorkflowActionPolicy policy(String actionCode, String fromStatus, String permission, WorkflowActorType actorType, String actorCode) {
        WorkflowActionPolicy p = new WorkflowActionPolicy();
        p.setActionCode(actionCode);
        p.setFromStatus(fromStatus);
        p.setModuleKey("DOCUMENT_CONTROL");
        p.setWorkflowKey("CONTROLLED_COPY");
        p.setObjectType("CONTROLLED_COPY");
        p.setRequiredPermissionCode(permission);
        p.setActive(true);
        p.setSystem(true);
        WorkflowActionPolicyActor actor = new WorkflowActionPolicyActor();
        actor.setPolicy(p);
        actor.setActorType(actorType);
        actor.setActorCode(actorCode);
        p.setActors(List.of(actor));
        return p;
    }

    private UserAccessProfile accessProfileMembership() {
        return accessProfileMembership(UUID.randomUUID());
    }

    private UserAccessProfile accessProfileMembership(UUID profileId) {
        UserAccessProfile profile = new UserAccessProfile();
        profile.setUserId(user.getId());
        profile.setAccessProfileId(profileId);
        return profile;
    }

    private DocumentStatusDefinition activeDocumentStatus() {
        DocumentStatusDefinition status = new DocumentStatusDefinition();
        status.setCode("ACTIVE");
        return status;
    }

    private RevisionStatusDefinition effectiveRevisionStatus() {
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode("EFFECTIVE");
        return status;
    }

}
