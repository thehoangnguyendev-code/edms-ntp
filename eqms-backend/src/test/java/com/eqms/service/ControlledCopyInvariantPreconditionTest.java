package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

/**
 * State/policy invariant coverage for {@link ControlledCopyAuthorizationService#checkInvariantPrecondition},
 * the logic {@code ControlledCopyResourceAdapter}/{@code ControlledCopyBatchResourceAdapter}
 * delegate to as one of {@code AuthorizationEngineService}'s evaluation steps post-cutover
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7 cutover rule 5). This invariant logic was
 * never removed by the cutover -- only the actor/permission matching around it was -- so this
 * replaces the invariant-only cases from the pre-cutover {@code ControlledCopyAuthorizationServiceTest}
 * that used to reach the same code through the now action-restricted {@code evaluateInternal}.
 */
@ExtendWith(MockitoExtension.class)
class ControlledCopyInvariantPreconditionTest {

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

    private ControlledCopyAuthorizationService service;
    private ControlledCopyPolicySetting policy;

    @BeforeEach
    void setUp() {
        service = new ControlledCopyAuthorizationService(
                permissionEvaluationService, currentUserService, documentAuthorizationService,
                controlledCopyPolicyService, secureFileAccessService, controlledCopyRepository,
                controlledCopyDistributionBatchRepository, workflowActionPolicyRepository,
                userAccessProfileRepository, accessProfileWorkflowRoleRepository,
                documentWorkflowPoolMemberRepository, documentRecordRepository
        );
        policy = new ControlledCopyPolicySetting();
        policy.setAllowDownload(true);
        policy.setAllowPortalView(true);
        policy.setAllowPrint(true);
        lenient().when(controlledCopyPolicyService.loadOrDefault()).thenReturn(policy);
    }

    private ControlledCopyAuthorizationContext copyContext(String statusCode, Instant expiryAt, String obsoleteReason) {
        return ControlledCopyAuthorizationContext.forCopy(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "ACTIVE", "EFFECTIVE", statusCode, obsoleteReason,
                UUID.randomUUID(), UUID.randomUUID(), expiryAt,
                policy.isAllowDownload(), policy.isAllowPortalView(), false);
    }

    @Test
    void downloadFile_downloadDisabledByPolicy_denied() {
        policy.setAllowDownload(false);
        ControlledCopyAuthorizationContext context = ControlledCopyAuthorizationContext.forCopy(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "ACTIVE", "EFFECTIVE", "DISTRIBUTED", null,
                UUID.randomUUID(), UUID.randomUUID(), null, false, true, false);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.DOWNLOAD_FILE, context, "CONTROLLED_COPY");

        assertThat(reason).contains("DOWNLOAD_NOT_ALLOWED_BY_POLICY");
    }

    @Test
    void downloadFile_expired_denied() {
        ControlledCopyAuthorizationContext context = copyContext("DISTRIBUTED", Instant.parse("2026-01-01T00:00:00Z"), null);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.DOWNLOAD_FILE, context, "CONTROLLED_COPY");

        assertThat(reason).contains("EXPIRED");
    }

    @Test
    void printCopy_policyDisabled_denied() {
        policy.setAllowPrint(false);
        ControlledCopyAuthorizationContext context = copyContext("DISTRIBUTED", null, null);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.PRINT_COPY, context, "CONTROLLED_COPY");

        assertThat(reason).contains("PRINT_NOT_ALLOWED_BY_POLICY");
    }

    @Test
    void printCopy_allowedByPolicyAndViewable_noPreconditionViolation() {
        ControlledCopyAuthorizationContext context = copyContext("DISTRIBUTED", null, null);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.PRINT_COPY, context, "CONTROLLED_COPY");

        assertThat(reason).isEmpty();
    }

    @Test
    void previewFile_obsoletedCopy_deniedInvalidState() {
        ControlledCopyAuthorizationContext context = copyContext("OBSOLETED", null, "Recalled");

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.PREVIEW_FILE, context, "CONTROLLED_COPY");

        assertThat(reason).contains("INVALID_CONTROLLED_COPY_STATE");
    }

    @Test
    void reportLostDamaged_beforeDistribution_deniedInvalidState() {
        ControlledCopyAuthorizationContext context = copyContext("READY_FOR_DISTRIBUTION", null, null);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED, context, "CONTROLLED_COPY");

        assertThat(reason).contains("INVALID_CONTROLLED_COPY_STATE");
    }

    @Test
    void reportLostDamaged_distributed_noPreconditionViolation() {
        ControlledCopyAuthorizationContext context = copyContext("DISTRIBUTED", null, null);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.REPORT_LOST_DAMAGED, context, "CONTROLLED_COPY");

        assertThat(reason).isEmpty();
    }

    @Test
    void replaceLostDamaged_obsoletedButNotLostOrDamaged_deniedInvalidReplacementSource() {
        ControlledCopyAuthorizationContext context = copyContext("OBSOLETED", null, "Recalled");

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, context, "CONTROLLED_COPY");

        assertThat(reason).contains("INVALID_REPLACEMENT_SOURCE");
    }

    @Test
    void replaceLostDamaged_obsoletedAndLost_noPreconditionViolation() {
        ControlledCopyAuthorizationContext context = copyContext("OBSOLETED", null, "Lost");

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.REPLACE_LOST_DAMAGED, context, "CONTROLLED_COPY");

        assertThat(reason).isEmpty();
    }

    @Test
    void recallBatch_distributed_noPreconditionViolation() {
        ControlledCopyAuthorizationContext context = ControlledCopyAuthorizationContext.forBatch(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "DISTRIBUTED", UUID.randomUUID(), null);

        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.RECALL_BATCH, context, "CONTROLLED_COPY_BATCH");

        assertThat(reason).isEmpty();
    }

    @Test
    void nullContext_returnsEmpty_notAnException() {
        Optional<String> reason = service.checkInvariantPrecondition(
                ControlledCopyWorkflowAction.PREVIEW_FILE, null, "CONTROLLED_COPY");

        assertThat(reason).isNotNull();
    }
}
