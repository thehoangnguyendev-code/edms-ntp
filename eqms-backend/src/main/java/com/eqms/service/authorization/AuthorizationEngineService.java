package com.eqms.service.authorization;

import com.eqms.entity.AuthorizationRelationDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.RelationResolverCode;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Single decision engine for the hybrid RBAC+ABAC+ReBAC+workflow/state+policy authorization model
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §3). Not yet called by any enforcement path --
 * this is Phase 0/1 scaffolding, run in shadow (alongside the legacy evaluator, decision-only)
 * once a module's {@link ResourceAuthorizationAdapter} exists, then promoted to the real decision
 * via feature flag per the plan's cutover rules (§7).
 *
 * <p>Steps implemented now: actor active, adapter/resource-type registered, policy resolution
 * (delegated to {@link ResourceAuthorizationAdapter#resolvePolicy} -- see that interface's javadoc
 * for why this is adapter-owned, not a single shared table), required permission, object
 * scope/explicit grant (steps 4-5 of §3), relation match (ANY/ALL). One step intentionally NOT yet
 * implemented, with the blocking reason:
 * <ul>
 *   <li>SoD (part of step 8) -- {@code SodConstraintService.checkPermissions} is an admin-facing,
 *       permission-gated method (throws for ordinary users) meant for validating a role's proposed
 *       permission set, not a per-decision runtime check; and it only compares permission-code
 *       pairs, not relation-vs-relation (e.g. "Author cannot Review own revision"). Runtime SoD
 *       needs its own schema/service, tracked separately.</li>
 * </ul>
 */
@Service
public class AuthorizationEngineService {

    private final PermissionEvaluationService permissionEvaluationService;
    private final AuthorizationRelationDefinitionRepository relationDefinitionRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final Map<String, ResourceAuthorizationAdapter> adaptersByResourceType;

    public AuthorizationEngineService(
            PermissionEvaluationService permissionEvaluationService,
            AuthorizationRelationDefinitionRepository relationDefinitionRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            List<ResourceAuthorizationAdapter> adapters
    ) {
        this.permissionEvaluationService = permissionEvaluationService;
        this.relationDefinitionRepository = relationDefinitionRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.adaptersByResourceType = adapters.stream()
                .collect(Collectors.toMap(ResourceAuthorizationAdapter::resourceType, a -> a));
    }

    @Transactional(readOnly = true)
    public AuthorizationDecision authorize(AuthorizationRequest request) {
        UserAccount actor = request.actor();
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) {
            return AuthorizationDecision.deny("USER_NOT_ACTIVE");
        }

        ResourceAuthorizationAdapter adapter = adaptersByResourceType.get(request.resourceType());
        if (adapter == null) {
            return AuthorizationDecision.deny("UNSUPPORTED_RESOURCE_TYPE");
        }

        String state = adapter.resolveState(request.resourceId());
        java.util.UUID documentTypeId = adapter.resolveDocumentTypeId(request.resourceId());

        Optional<ResolvedPolicy> policyOpt = adapter.resolvePolicy(request.actionCode(), state, documentTypeId);
        if (policyOpt.isEmpty()) {
            String reason = adapter.explainMissingPolicy(request.actionCode(), state).orElse("POLICY_NOT_CONFIGURED");
            return AuthorizationDecision.deny(reason, null, state);
        }
        ResolvedPolicy policy = policyOpt.get();

        Optional<String> preconditionFailure = adapter.checkPrecondition(request.resourceId(), request.actionCode());
        if (preconditionFailure.isPresent()) {
            return AuthorizationDecision.deny(preconditionFailure.get(), policy.requiredPermissionCode(), state);
        }

        String requiredPermission = policy.requiredPermissionCode();
        if (requiredPermission != null && !requiredPermission.isBlank()
                && !permissionEvaluationService.hasPermission(actor, requiredPermission)) {
            return AuthorizationDecision.deny("MISSING_PERMISSION", requiredPermission, state);
        }

        if (!adapter.isWithinObjectScope(actor, request.resourceId(), request.actionCode())) {
            return AuthorizationDecision.deny("OUT_OF_SCOPE", requiredPermission, state);
        }

        List<String> matchedRelations = List.of();
        List<String> requiredRelationCodes = policy.requiredRelationCodes();
        if (!requiredRelationCodes.isEmpty()) {
            Set<String> actorRelations = new HashSet<>(adapter.resolveMatchedRelations(actor, request.resourceId()));
            actorRelations.addAll(resolveGenericRelations(actor, request.resourceType(), requiredRelationCodes));
            Set<String> required = new HashSet<>(requiredRelationCodes);
            Set<String> matched = new HashSet<>(actorRelations);
            matched.retainAll(required);

            boolean relationSatisfied = "ALL".equals(policy.relationMatchRule())
                    ? matched.containsAll(required)
                    : !matched.isEmpty();
            if (!relationSatisfied) {
                return AuthorizationDecision.deny("ACTOR_NOT_ALLOWED", requiredPermission, state);
            }
            matchedRelations = List.copyOf(matched);
        }

        // TODO: runtime SoD (permission-pair and relation-vs-relation) -- see class javadoc.

        Map<String, Object> requiredControls = new HashMap<>();
        return AuthorizationDecision.allow(
                requiredPermission, List.of(), matchedRelations, policy.policyVersion(), state, requiredControls);
    }

    /** Relation definitions currently registered for a resource type -- used by admin UIs/tests. */
    @Transactional(readOnly = true)
    public List<AuthorizationRelationDefinition> relationDefinitionsFor(String resourceType) {
        return relationDefinitionRepository.findAllByResourceTypeAndActiveTrueOrderByCodeAsc(resourceType);
    }

    /**
     * Resolves the subset of {@code requiredRelationCodes} whose definition uses a
     * resource-agnostic resolver (PERMISSION_RESOLVER / ACCESS_PROFILE_RESOLVER) -- these only
     * depend on the actor's own permissions/profile membership, not resource state, so the engine
     * resolves them itself rather than delegating to the adapter (see V353).
     */
    private Set<String> resolveGenericRelations(UserAccount actor, String resourceType, List<String> requiredRelationCodes) {
        Set<String> matched = new HashSet<>();
        for (String code : requiredRelationCodes) {
            AuthorizationRelationDefinition definition =
                    relationDefinitionRepository.findByCodeAndResourceType(code, resourceType).orElse(null);
            if (definition == null || definition.getResolverConfig() == null) {
                continue;
            }
            String resolverCode = definition.getResolverCode();
            if (RelationResolverCode.PERMISSION_RESOLVER.name().equals(resolverCode)) {
                String permissionCode = textOrNull(definition.getResolverConfig().get("permissionCode"));
                if (permissionCode != null && permissionEvaluationService.hasPermission(actor, permissionCode)) {
                    matched.add(code);
                }
            } else if (RelationResolverCode.ACCESS_PROFILE_RESOLVER.name().equals(resolverCode)) {
                String profileCode = textOrNull(definition.getResolverConfig().get("profileCode"));
                if (profileCode != null
                        && userAccessProfileRepository.existsByUserIdAndProfileCode(actor.getId(), profileCode)) {
                    matched.add(code);
                }
            }
        }
        return matched;
    }

    private String textOrNull(com.fasterxml.jackson.databind.JsonNode node) {
        return node == null || node.isNull() ? null : node.asText(null);
    }
}
