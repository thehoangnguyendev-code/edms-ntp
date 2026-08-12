package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.repository.*;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * CONTROLLED_COPY / CONTROLLED_COPY_BATCH completed their hybrid-engine cutover
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7 cutover rule 5) for every action except
 * REQUEST_COPY, which structurally has no resourceId at evaluation time and remains on the
 * legacy path -- see {@code ControlledCopyAuthorizationServiceTest} for that one action.
 * {@link AuthorizationEngineService} is the sole decision authority for all other actions here,
 * with no legacy fallback.
 */
@ExtendWith(MockitoExtension.class)
class ControlledCopyAuthorizationServiceCutoverTest {

    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private CurrentUserService currentUserService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private ControlledCopyPolicyService controlledCopyPolicyService;
    @Mock private SecureFileAccessService secureFileAccessService;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Mock private WorkflowActionPolicyRepository workflowActionPolicyRepository;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository;
    @Mock private DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private ObjectAccessEvaluationService objectAccessEvaluationService;
    @Mock private AuthorizationEngineService authorizationEngineService;

    private UserAccount user;
    private ControlledCopyAuthorizationContext copyContext;
    private UUID copyId;

    private ControlledCopyAuthorizationService newService() {
        return new ControlledCopyAuthorizationService(
                permissionEvaluationService, currentUserService, documentAuthorizationService,
                controlledCopyPolicyService, secureFileAccessService, controlledCopyRepository,
                controlledCopyDistributionBatchRepository, workflowActionPolicyRepository,
                userAccessProfileRepository, accessProfileWorkflowRoleRepository,
                documentWorkflowPoolMemberRepository, documentRecordRepository,
                objectAccessEvaluationService, null, authorizationEngineService);
    }

    @BeforeEach
    void setUp() {
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);

        copyId = UUID.randomUUID();
        copyContext = ControlledCopyAuthorizationContext.forCopy(
                copyId, null, null, null, "ACTIVE", "EFFECTIVE", "DISTRIBUTED", null,
                user.getId(), user.getId(), null, true, true, false);
    }

    @Test
    void allowsWhenEngineAllows() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.controlled_copy.preview_file", List.of(), List.of("OWNER"), 1L, "DISTRIBUTED", Map.of()));

        var decision = newService().evaluate(user, ControlledCopyWorkflowAction.PREVIEW_FILE, copyContext);

        assertThat(decision.allowed()).isTrue();
    }

    @Test
    void deniesWhenEngineDenies_andPassesThroughReasonCode() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.deny("ACTOR_NOT_ALLOWED", "documents.controlled_copy.preview_file", "DISTRIBUTED"));

        var decision = newService().evaluate(user, ControlledCopyWorkflowAction.PREVIEW_FILE, copyContext);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");
    }

    @Test
    void requestSentToEngineCarriesResourceTypeIdAndAction() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.controlled_copy.preview_file", List.of(), List.of("OWNER"), 1L, "DISTRIBUTED", Map.of()));

        newService().evaluate(user, ControlledCopyWorkflowAction.PREVIEW_FILE, copyContext);

        verify(authorizationEngineService).authorize(argThat(req ->
                "CONTROLLED_COPY".equals(req.resourceType())
                        && copyId.equals(req.resourceId())
                        && "PREVIEW_FILE".equals(req.actionCode())));
    }

    @Test
    void failsClosedWhenEngineThrows() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenThrow(new RuntimeException("boom"));

        var decision = newService().evaluate(user, ControlledCopyWorkflowAction.PREVIEW_FILE, copyContext);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("AUTHORIZATION_ENGINE_ERROR");
    }

    @Test
    void deniesWithoutCallingEngine_whenInputIsIncomplete() {
        var decision = newService().evaluate(null, ControlledCopyWorkflowAction.PREVIEW_FILE, copyContext);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("WORKFLOW_ACTION_NOT_ALLOWED");
        verifyNoInteractions(authorizationEngineService);
    }

    @Test
    void batchActionResolvesBatchResourceType() {
        UUID batchId = UUID.randomUUID();
        ControlledCopyAuthorizationContext batchContext = ControlledCopyAuthorizationContext.forBatch(
                batchId, null, null, "READY_FOR_DISTRIBUTION", user.getId(), null);
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.controlled_copy.distribute", List.of(), List.of(), 1L, "READY_FOR_DISTRIBUTION", Map.of()));

        newService().evaluate(user, ControlledCopyWorkflowAction.DISTRIBUTE_BATCH, batchContext);

        verify(authorizationEngineService).authorize(argThat(req ->
                "CONTROLLED_COPY_BATCH".equals(req.resourceType()) && batchId.equals(req.resourceId())));
    }

    @Test
    void requestCopy_neverCallsEngine_remainsOnLegacyPath() {
        ControlledCopyAuthorizationContext requestContext = ControlledCopyAuthorizationContext.forRequest(
                UUID.randomUUID(), UUID.randomUUID(), "ACTIVE", "DRAFT", user.getId());

        newService().evaluate(user, ControlledCopyWorkflowAction.REQUEST_COPY, requestContext);

        verifyNoInteractions(authorizationEngineService);
    }
}
