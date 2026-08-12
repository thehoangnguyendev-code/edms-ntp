package com.eqms.service;

import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.authorization.ResolvedPolicy;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * First real {@link ResourceAuthorizationAdapter} (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
 * Phase 1-2, "Document Master + Revision" cutover block). Deliberately placed in {@code
 * com.eqms.service} (not {@code com.eqms.service.authorization}) so it can call
 * {@link RevisionWorkflowAuthorizationService}'s package-visible assignment helpers directly --
 * those already implement the exact same Author/Co-Author/sequence-aware Reviewer/Approver logic
 * this adapter needs, and re-implementing it here would create a second, driftable source of
 * truth (the class the whole HYBRID_REFACTOR_PLAN.md effort exists to eliminate).
 *
 * <p>This bean only supplies read-only facts to {@code AuthorizationEngineService}. It does not
 * enforce anything by itself and is not yet called from any mutation/capability path -- wiring
 * shadow-evaluation calls at the real enforcement point is the next Phase 1-2 step.
 */
@Component
public class RevisionResourceAdapter implements ResourceAuthorizationAdapter {

    private static final String MODULE_KEY = "DOCUMENT_CONTROL";
    private static final String WORKFLOW_KEY = "DOCUMENT_REVISION";

    private final DocumentRevisionRepository revisionRepository;
    private final RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;
    private final WorkflowActionPolicyService workflowActionPolicyService;
    private final WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;

    public RevisionResourceAdapter(
            DocumentRevisionRepository revisionRepository,
            RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService,
            ObjectAccessEvaluationService objectAccessEvaluationService,
            WorkflowActionPolicyService workflowActionPolicyService,
            WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository
    ) {
        this.revisionRepository = revisionRepository;
        this.revisionWorkflowAuthorizationService = revisionWorkflowAuthorizationService;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
        this.workflowActionPolicyService = workflowActionPolicyService;
        this.workflowActionPolicyRelationRepository = workflowActionPolicyRelationRepository;
    }

    @Override
    public String resourceType() { return "REVISION"; }

    @Override
    public String resolveState(UUID resourceId) {
        DocumentRevisionRecord revision = findRevision(resourceId);
        return revision == null || revision.getStatus() == null ? null : revision.getStatus().getCode();
    }

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        DocumentRevisionRecord revision = findRevision(resourceId);
        if (revision == null || revision.getDocument() == null || revision.getDocument().getDocumentType() == null) {
            return null;
        }
        return revision.getDocument().getDocumentType().getId();
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        return workflowActionPolicyService
                .resolvePolicy(MODULE_KEY, WORKFLOW_KEY, "REVISION", actionCode, state, documentTypeId)
                .map(policy -> new ResolvedPolicy(
                        policy.getRequiredPermissionCode(),
                        policy.getVersion(),
                        requiredRelationCodes(policy),
                        policy.getRelationMatchRule()));
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
        DocumentRevisionRecord revision = findRevision(resourceId);
        if (revision == null) {
            return Set.of();
        }
        Set<String> relations = new HashSet<>();
        if (revisionWorkflowAuthorizationService.isRevisionAuthor(actor, revision)) {
            relations.add("AUTHOR");
        }
        if (revisionWorkflowAuthorizationService.isRevisionCoAuthor(actor, revision)) {
            relations.add("CO_AUTHOR");
        }
        if (revisionWorkflowAuthorizationService.isPendingReviewer(actor, revision)) {
            relations.add("ASSIGNED_REVIEWER");
        }
        if (revisionWorkflowAuthorizationService.isPendingApprover(actor, revision)) {
            relations.add("ASSIGNED_APPROVER");
        }
        return relations;
    }

    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        DocumentRevisionRecord revision = findRevision(resourceId);
        if (revision == null) {
            return false;
        }
        return objectAccessEvaluationService.canAccessRevision(actor, revision, action);
    }

    @Override
    public Optional<String> checkPrecondition(UUID resourceId, String actionCode) {
        DocumentRevisionRecord revision = findRevision(resourceId);
        if (revision == null) {
            return Optional.empty();
        }
        RevisionWorkflowAction action;
        try {
            action = RevisionWorkflowAction.valueOf(actionCode);
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
        return revisionWorkflowAuthorizationService.checkStatePrecondition(
                revision, action, RevisionWorkflowAuthorizationContext.of(revision));
    }

    private DocumentRevisionRecord findRevision(UUID resourceId) {
        return resourceId == null ? null : revisionRepository.findById(resourceId).orElse(null);
    }
}
