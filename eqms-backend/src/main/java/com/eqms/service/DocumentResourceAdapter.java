package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.service.authorization.ResolvedPolicy;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Second real {@link ResourceAuthorizationAdapter} (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
 * Phase 1-2). Document Master's real enforcement, verified against the running code, is split
 * across THREE different mechanisms -- unlike Revision's uniform {@code workflow_action_policies}:
 * <ul>
 *   <li>{@code CANCEL}/{@code OBSOLETE} -- {@code lifecycle_state_policies}, read here directly
 *       (mirrors {@link DocumentMasterWorkflowAuthorizationService}, not reusing it, since that
 *       class's {@code Decision} type is specific to its own call sites and only accepts
 *       CANCEL/OBSOLETE by design).</li>
 *   <li>{@code UPDATE_METADATA} -- no policy table at all; {@code DocumentService} checks
 *       {@code documents.document.edit_metadata} directly. Mirrored here as a synthesized policy
 *       (permission-only, no relation requirement) so the shadow evaluator can compare against it
 *       faithfully -- this is NOT a new authorization rule, it is the existing one made visible to
 *       the engine.</li>
 *   <li>{@code REOPEN} -- no implementation exists anywhere in the codebase (no controller
 *       endpoint). {@link #resolvePolicy} returns empty for it, which is the correct "not
 *       configured" answer, not a bug in this adapter.</li>
 * </ul>
 */
@Component
public class DocumentResourceAdapter implements ResourceAuthorizationAdapter {

    private static final String MODULE_KEY = "documents";
    private static final String OBJECT_TYPE = "DOCUMENT";
    private static final String UPDATE_METADATA_PERMISSION = "documents.document.configure_next_metadata";

    private final DocumentRecordRepository documentRepository;
    private final LifecycleStatePolicyRepository lifecycleStatePolicyRepository;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;

    public DocumentResourceAdapter(
            DocumentRecordRepository documentRepository,
            LifecycleStatePolicyRepository lifecycleStatePolicyRepository,
            ObjectAccessEvaluationService objectAccessEvaluationService
    ) {
        this.documentRepository = documentRepository;
        this.lifecycleStatePolicyRepository = lifecycleStatePolicyRepository;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
    }

    @Override
    public String resourceType() { return "DOCUMENT"; }

    @Override
    public String resolveState(UUID resourceId) {
        DocumentRecord document = findDocument(resourceId);
        return document == null || document.getStatus() == null ? null : document.getStatus().getCode();
    }

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        DocumentRecord document = findDocument(resourceId);
        return document == null || document.getDocumentType() == null ? null : document.getDocumentType().getId();
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        if ("UPDATE_METADATA".equals(actionCode)) {
            return Optional.of(new ResolvedPolicy(UPDATE_METADATA_PERMISSION, null, List.of(), "ANY"));
        }
        if (!"CANCEL".equals(actionCode) && !"OBSOLETE".equals(actionCode)) {
            // Includes REOPEN: no real implementation exists, so "not configured" is correct.
            return Optional.empty();
        }
        return lifecycleStatePolicyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        MODULE_KEY, OBJECT_TYPE, actionCode)
                .stream()
                .filter(p -> p.getStatusCode() == null || p.getStatusCode().equalsIgnoreCase(state))
                .filter(p -> p.getDocumentTypeId() == null || p.getDocumentTypeId().equals(documentTypeId))
                .max(java.util.Comparator.comparing(LifecycleStatePolicy::getPriority, java.util.Comparator.nullsLast(Integer::compareTo)))
                .map(p -> new ResolvedPolicy(
                        p.getRequiredPermissionCode(),
                        p.getVersion(),
                        "ANY".equals(p.getActorScope()) ? List.of() : List.of("OWNER"),
                        "ANY"));
    }

    @Override
    public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) {
        DocumentRecord document = findDocument(resourceId);
        if (document == null || actor == null || actor.getId() == null) {
            return Set.of();
        }
        Set<String> relations = new HashSet<>();
        if (document.getOwner() != null && Objects.equals(document.getOwner().getId(), actor.getId())) {
            relations.add("OWNER");
        }
        return relations;
    }

    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        DocumentRecord document = findDocument(resourceId);
        if (document == null) {
            return false;
        }
        return objectAccessEvaluationService.canAccessDocument(actor, document, action);
    }

    private DocumentRecord findDocument(UUID resourceId) {
        return resourceId == null ? null : documentRepository.findById(resourceId).orElse(null);
    }
}
