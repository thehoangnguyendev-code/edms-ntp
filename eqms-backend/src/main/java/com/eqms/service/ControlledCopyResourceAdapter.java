package com.eqms.service;

import com.eqms.dto.security.ControlledCopyAuthorizationContext;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.repository.ControlledCopyRepository;
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
 * {@link ResourceAuthorizationAdapter} for individual Controlled Copy records
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md Phase 3). Deliberately placed in {@code
 * com.eqms.service}, not {@code com.eqms.service.authorization}, so it can call {@link
 * ControlledCopyAuthorizationService}'s package-visible helpers directly instead of
 * re-implementing requester/recipient/document-viewer matching a second time.
 *
 * <p>DISTRIBUTE_COPY is a module-level entitlement in the legacy evaluator (permission alone,
 * no actor list consulted -- see {@code ControlledCopyAuthorizationService#isGlobalDistributionAction}),
 * so no relations are ever seeded for it and {@link #resolveMatchedRelations} is simply never
 * consulted for that action (empty required-relation list -> engine skips the relation step).
 */
@Component
public class ControlledCopyResourceAdapter implements ResourceAuthorizationAdapter {

    private static final String MODULE_KEY = "DOCUMENT_CONTROL";
    private static final String WORKFLOW_KEY = "CONTROLLED_COPY";
    private static final String OBJECT_TYPE = "CONTROLLED_COPY";

    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;
    private final WorkflowActionPolicyService workflowActionPolicyService;
    private final WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;
    private final WorkflowActionPolicyRepository workflowActionPolicyRepository;

    public ControlledCopyResourceAdapter(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyAuthorizationService controlledCopyAuthorizationService,
            ObjectAccessEvaluationService objectAccessEvaluationService,
            WorkflowActionPolicyService workflowActionPolicyService,
            WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository,
            WorkflowActionPolicyRepository workflowActionPolicyRepository
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.controlledCopyAuthorizationService = controlledCopyAuthorizationService;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
        this.workflowActionPolicyService = workflowActionPolicyService;
        this.workflowActionPolicyRelationRepository = workflowActionPolicyRelationRepository;
        this.workflowActionPolicyRepository = workflowActionPolicyRepository;
    }

    @Override
    public String resourceType() { return OBJECT_TYPE; }

    @Override
    public String resolveState(UUID resourceId) {
        ControlledCopyRecord copy = findCopy(resourceId);
        return copy == null ? null : copy.getStatusCode();
    }

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        return null;
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        if (ControlledCopyWorkflowAction.REQUEST_COPY.name().equals(actionCode)) {
            // Known scope exclusion (Phase 3 shadow-eval finding): the legacy evaluator resolves
            // REQUEST_COPY's current-status against the *revision's* status, not the copy's
            // (ControlledCopyAuthorizationService#resolveCurrentStatus) -- but this interface's
            // resolveState(resourceId) is action-agnostic and can only ever see the copy's own
            // status. REQUEST_COPY also has no real target copy in the normal request flow
            // (requireRequestControlledCopy builds a copyless "forRequest" context); the only
            // path that reaches this adapter with an existing copyId is the Security Admin
            // diagnosis tool evaluating REQUEST_COPY against an unrelated existing copy, which is
            // not representative of real enforcement. Denying here (rather than silently
            // mis-resolving state) is the safe choice until the adapter contract grows an
            // action-aware state resolver.
            return Optional.empty();
        }
        return workflowActionPolicyService
                .resolvePolicy(MODULE_KEY, WORKFLOW_KEY, OBJECT_TYPE, actionCode, state, null)
                .map(policy -> new ResolvedPolicy(
                        policy.getRequiredPermissionCode(),
                        policy.getVersion(),
                        requiredRelationCodes(policy),
                        policy.getRelationMatchRule()));
    }

    @Override
    public Optional<String> explainMissingPolicy(String actionCode, String state) {
        // The action IS wired up (a policy row exists for at least one other state) -- this
        // resource instance is just in a state where it doesn't apply, matching how the legacy
        // evaluator's per-action state checks already report it, instead of the engine's generic
        // "nothing configured at all" fallback.
        boolean actionConfiguredForOtherStates = workflowActionPolicyRepository
                .existsByModuleKeyAndWorkflowKeyAndObjectTypeAndActionCodeAndActiveTrue(MODULE_KEY, WORKFLOW_KEY, OBJECT_TYPE, actionCode);
        return actionConfiguredForOtherStates ? Optional.of("INVALID_CONTROLLED_COPY_STATE") : Optional.empty();
    }

    private java.util.List<String> requiredRelationCodes(WorkflowActionPolicy policy) {
        return workflowActionPolicyRelationRepository
                .findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(policy.getId())
                .stream()
                .map(r -> r.getRelationDefinition().getCode())
                .toList();
    }

    @Override
    public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) {
        ControlledCopyRecord copy = findCopy(resourceId);
        if (copy == null) {
            return Set.of();
        }
        ControlledCopyAuthorizationContext context = controlledCopyAuthorizationService.buildCopyContext(copy);
        Set<String> relations = new HashSet<>();
        if (controlledCopyAuthorizationService.matchesRequesterOrRecipient(actor, context)) {
            relations.add("OWNER");
        }
        if (controlledCopyAuthorizationService.matchesDocumentViewer(actor, context)) {
            relations.add("RECIPIENT");
        }
        return relations;
    }

    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        ControlledCopyRecord copy = findCopy(resourceId);
        if (copy == null || copy.getDocument() == null) {
            return false;
        }
        return objectAccessEvaluationService.canAccessDocument(actor, copy.getDocument(), "VIEW");
    }

    @Override
    public Optional<String> checkPrecondition(UUID resourceId, String actionCode) {
        ControlledCopyRecord copy = findCopy(resourceId);
        if (copy == null) {
            return Optional.empty();
        }
        ControlledCopyWorkflowAction action;
        try {
            action = ControlledCopyWorkflowAction.valueOf(actionCode);
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
        ControlledCopyAuthorizationContext context = controlledCopyAuthorizationService.buildCopyContext(copy);
        return controlledCopyAuthorizationService.checkInvariantPrecondition(action, context, OBJECT_TYPE);
    }

    private ControlledCopyRecord findCopy(UUID resourceId) {
        return resourceId == null ? null : controlledCopyRepository.findById(resourceId).orElse(null);
    }
}
