package com.eqms.service;

import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.repository.WorkflowActionPolicyRepository;
import com.eqms.service.authorization.ResolvedPolicy;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * {@link ResourceAuthorizationAdapter} for Controlled Copy distribution batches
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 3). Sibling of
 * {@link ControlledCopyResourceAdapter} -- see that class's javadoc for why this lives in
 * {@code com.eqms.service} and why DISTRIBUTE_BATCH needs no seeded relations.
 */
@Component
public class ControlledCopyBatchResourceAdapter implements ResourceAuthorizationAdapter {

    private static final String MODULE_KEY = "DOCUMENT_CONTROL";
    private static final String WORKFLOW_KEY = "CONTROLLED_COPY";
    private static final String OBJECT_TYPE = "CONTROLLED_COPY_BATCH";

    private final ControlledCopyDistributionBatchRepository batchRepository;
    private final ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    private final WorkflowActionPolicyService workflowActionPolicyService;
    private final WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;
    private final WorkflowActionPolicyRepository workflowActionPolicyRepository;

    public ControlledCopyBatchResourceAdapter(
            ControlledCopyDistributionBatchRepository batchRepository,
            ControlledCopyAuthorizationService controlledCopyAuthorizationService,
            WorkflowActionPolicyService workflowActionPolicyService,
            WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository,
            WorkflowActionPolicyRepository workflowActionPolicyRepository
    ) {
        this.batchRepository = batchRepository;
        this.controlledCopyAuthorizationService = controlledCopyAuthorizationService;
        this.workflowActionPolicyService = workflowActionPolicyService;
        this.workflowActionPolicyRelationRepository = workflowActionPolicyRelationRepository;
        this.workflowActionPolicyRepository = workflowActionPolicyRepository;
    }

    @Override
    public String resourceType() { return OBJECT_TYPE; }

    @Override
    public String resolveState(UUID resourceId) {
        ControlledCopyDistributionBatch batch = findBatch(resourceId);
        return batch == null ? null : batch.getStatusCode();
    }

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        return null;
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        return workflowActionPolicyService
                .resolvePolicy(MODULE_KEY, WORKFLOW_KEY, OBJECT_TYPE, actionCode, state, null)
                .map(policy -> new ResolvedPolicy(
                        policy.getRequiredPermissionCode(),
                        policy.getVersion(),
                        requiredRelationCodes(policy),
                        policy.getRelationMatchRule(),
                        forbiddenRelationCodes(policy)));
    }

    @Override
    public Optional<String> explainMissingPolicy(String actionCode, String state) {
        boolean actionConfiguredForOtherStates = workflowActionPolicyRepository
                .existsByModuleKeyAndWorkflowKeyAndObjectTypeAndActionCodeAndActiveTrue(MODULE_KEY, WORKFLOW_KEY, OBJECT_TYPE, actionCode);
        return actionConfiguredForOtherStates ? Optional.of("INVALID_CONTROLLED_COPY_STATE") : Optional.empty();
    }

    private java.util.List<String> requiredRelationCodes(WorkflowActionPolicy policy) {
        return workflowActionPolicyRelationRepository
                .findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(policy.getId())
                .stream()
                .filter(r -> !r.isForbidden())
                .map(r -> r.getRelationDefinition().getCode())
                .toList();
    }

    private java.util.List<String> forbiddenRelationCodes(WorkflowActionPolicy policy) {
        return workflowActionPolicyRelationRepository
                .findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(policy.getId())
                .stream()
                .filter(r -> r.isForbidden())
                .map(r -> r.getRelationDefinition().getCode())
                .toList();
    }

    @Override
    public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) {
        ControlledCopyDistributionBatch batch = findBatch(resourceId);
        if (batch == null) {
            return Set.of();
        }
        ControlledCopyAuthorizationContext context = controlledCopyAuthorizationService.buildBatchContext(batch);
        Set<String> relations = new HashSet<>();
        if (controlledCopyAuthorizationService.matchesRequesterOrRecipient(actor, context)) {
            relations.add("OWNER");
        }
        return relations;
    }

    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        ControlledCopyDistributionBatch batch = findBatch(resourceId);
        // No department or Access Profile scope any more (VISIBILITY-TIERS-2026-11-20): the step only confirms that the batch and its Document exist.
        return batch != null && batch.getDocument() != null;
    }

    @Override
    public Optional<String> checkPrecondition(UUID resourceId, String actionCode) {
        ControlledCopyDistributionBatch batch = findBatch(resourceId);
        if (batch == null) {
            return Optional.empty();
        }
        ControlledCopyWorkflowAction action;
        try {
            action = ControlledCopyWorkflowAction.valueOf(actionCode);
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
        ControlledCopyAuthorizationContext context = controlledCopyAuthorizationService.buildBatchContext(batch);
        return controlledCopyAuthorizationService.checkInvariantPrecondition(action, context, OBJECT_TYPE);
    }

    private ControlledCopyDistributionBatch findBatch(UUID resourceId) {
        return resourceId == null ? null : batchRepository.findById(resourceId).orElse(null);
    }
}
