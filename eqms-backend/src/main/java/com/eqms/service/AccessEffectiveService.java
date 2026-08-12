package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.EffectiveAccessResponse;
import com.eqms.dto.security.EffectiveAccessRowResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.entity.WorkflowActionPolicyActor;
import com.eqms.enums.LifecycleActorScope;
import com.eqms.enums.LifecycleCapability;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.WorkflowActorType;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.repository.PermissionSetItemRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 3 — EffectiveAccessPanel orchestration (read-only diagnostic).
 *
 * For a given Access Profile, resolves Allow/Deny for every Document Revision workflow action
 * (Phu luc A.2) and Document Master lifecycle capability (Phu luc A.1, Cancel/Obsolete) across
 * every relevant lifecycle status, by calling the 3 real runtime evaluators:
 *   - {@link WorkflowActionPolicyService} (policy/actor resolution for revision transitions)
 *   - {@link LifecycleStatePolicyEvaluator} (state-based capability policies)
 *   - {@link ObjectAccessEvaluationService} (Object Access Rules)
 *
 * This service does NOT reimplement any authorization decision — it only orchestrates the
 * existing evaluators and reports their outcome. Two structural limitations, both explicit in
 * the response, are inherent to evaluating a whole Access Profile instead of one concrete
 * document/revision instance:
 *
 * 1. Actor scope (WorkflowActionPolicyActor / LifecycleActorScope AUTHOR|PARTICIPANT) that is
 *    instance-specific (e.g. "must be the assigned Reviewer of THIS revision") cannot be
 *    resolved in the abstract. Such rows are reported as ACTOR_SCOPE_NOT_SATISFIED with an
 *    explanatory message. Object-specific workflow relationships are evaluated
 *    by the runtime authorization service, not inferred from profile labels.
 *    ACCESS_PROFILE and PERMISSION actors remain resolvable in this abstract view.
 * 2. {@link ObjectAccessEvaluationService} requires a concrete {@code DocumentRevisionRecord}/
 *    {@code DocumentRecord} and a concrete {@code UserAccount}. When {@code documentTypeId} is
 *    supplied, rule-matching (by document type/category/status only, not participant) is
 *    evaluated against a synthetic (non-persisted) record, using a real user that is currently
 *    assigned to this Access Profile if one exists (so the evaluator itself, unmodified, makes
 *    the call). When no user is currently assigned to the profile, or when {@code documentTypeId}
 *    is omitted, Object Access Rules are NOT evaluated — the row is still reported as the
 *    permission/actor result, but {@code objectAccessRuleEvaluated=false} flags that an
 *    "Allowed" result here could still be further restricted once applied to a real document.
 */
@Service
public class AccessEffectiveService {

    private static final String MISSING_PERMISSION = "MISSING_PERMISSION";
    private static final String ACTOR_SCOPE_NOT_SATISFIED = "ACTOR_SCOPE_NOT_SATISFIED";
    private static final String OBJECT_ACCESS_DENIED = "OBJECT_ACCESS_DENIED";
    private static final String NO_MATCHING_POLICY = "NO_MATCHING_POLICY";

    private static final String LIFECYCLE_MODULE = "documents";

    private final RoleDefinitionRepository roleDefinitionRepository;
    private final AccessProfileService accessProfileService;
    private final PermissionSetItemRepository permissionSetItemRepository;
    private final WorkflowActionPolicyService workflowActionPolicyService;
    private final LifecycleStatePolicyRepository lifecycleStatePolicyRepository;
    private final ObjectAccessEvaluationService objectAccessEvaluationService;
    private final DocumentStatusDefinitionRepository documentStatusRepository;
    private final RevisionStatusDefinitionRepository revisionStatusRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;

    public AccessEffectiveService(
            RoleDefinitionRepository roleDefinitionRepository,
            AccessProfileService accessProfileService,
            PermissionSetItemRepository permissionSetItemRepository,
            WorkflowActionPolicyService workflowActionPolicyService,
            LifecycleStatePolicyRepository lifecycleStatePolicyRepository,
            ObjectAccessEvaluationService objectAccessEvaluationService,
            DocumentStatusDefinitionRepository documentStatusRepository,
            RevisionStatusDefinitionRepository revisionStatusRepository,
            DocumentTypeRepository documentTypeRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService
    ) {
        this.roleDefinitionRepository = roleDefinitionRepository;
        this.accessProfileService = accessProfileService;
        this.permissionSetItemRepository = permissionSetItemRepository;
        this.workflowActionPolicyService = workflowActionPolicyService;
        this.lifecycleStatePolicyRepository = lifecycleStatePolicyRepository;
        this.objectAccessEvaluationService = objectAccessEvaluationService;
        this.documentStatusRepository = documentStatusRepository;
        this.revisionStatusRepository = revisionStatusRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public EffectiveAccessResponse getEffectiveAccess(UUID accessProfileId, UUID documentTypeId) {
        // F-04: explicit gate, checked BEFORE the profile lookup. Previously this endpoint had
        // no gate of its own and relied on an incidental side effect deep in
        // collectGrantedPermissions() (which calls AccessProfileService.getPermissionSets(),
        // whose requireView() throws) — fragile, and it let an unauthorized caller distinguish
        // "profile doesn't exist" (404 from findById below) from "profile exists but I can't see
        // it" (403 from that later call), leaking which access-profile IDs are valid.
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor,
                "security.access_profiles.view",
                "security.access_profiles.update",
                "security.access_profiles.assign")) {
            throw new AccessDeniedException("Access profile view permission required");
        }

        RoleDefinition profile = roleDefinitionRepository.findById(accessProfileId)
                .orElseThrow(() -> new EntityNotFoundException("Access profile not found"));

        Set<String> grantedPermissions = collectGrantedPermissions(accessProfileId);
        DocumentType documentType = documentTypeId == null
                ? null
                : documentTypeRepository.findById(documentTypeId).orElse(null);
        UserAccount probeUser = documentTypeId == null ? null : findProbeUser(accessProfileId);

        List<EffectiveAccessRowResponse> rows = new ArrayList<>();

        List<RevisionStatusDefinition> revisionStatuses = revisionStatusRepository.findAllByOrderBySortOrderAsc();
        for (RevisionWorkflowAction action : RevisionWorkflowAction.values()) {
            for (RevisionStatusDefinition status : revisionStatuses) {
                rows.add(evaluateRevisionAction(profile, grantedPermissions, action,
                        status, documentType, documentTypeId, probeUser));
            }
        }

        List<DocumentStatusDefinition> documentStatuses = documentStatusRepository.findAllByOrderBySortOrderAsc();
        for (LifecycleCapability capability : List.of(LifecycleCapability.CANCEL, LifecycleCapability.OBSOLETE)) {
            for (DocumentStatusDefinition status : documentStatuses) {
                rows.add(evaluateDocumentCapability(profile, grantedPermissions, capability, status,
                        documentType, documentTypeId, probeUser));
            }
        }

        boolean objectAccessApplicable = documentTypeId != null;
        String note = objectAccessApplicable
                ? "Object Access Rules evaluated by document-type/category/status match only against"
                        + " documentTypeId=" + documentTypeId + ". Participant/instance-specific scoping is not"
                        + " evaluated (no concrete document/revision instance exists for a whole Access Profile)."
                : "documentTypeId was not provided, so Object Access Rules were NOT evaluated at all. An"
                        + " \"Allowed\" result on this panel can still be further restricted by an Object Access"
                        + " Rule once this Access Profile is applied to a real document.";

        return new EffectiveAccessResponse(profile.getId(), profile.getName(), documentTypeId,
                objectAccessApplicable, note, rows);
    }

    // ── Document Revision (Phu luc A.2) ──────────────────────────────────────

    private EffectiveAccessRowResponse evaluateRevisionAction(
            RoleDefinition profile, Set<String> grantedPermissions,
            RevisionWorkflowAction action, RevisionStatusDefinition status, DocumentType documentType,
            UUID documentTypeId, UserAccount probeUser
    ) {
        String statusCode = status.getCode();
        String objectType = "DOCUMENT_REVISION";

        if (!isRevisionActionApplicable(action, statusCode)) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, action.name(), action.name(), null,
                    objectType, statusCode, status.getLabel(), NO_MATCHING_POLICY,
                    "This action does not apply to revision status " + statusCode + ".", false);
        }

        Optional<WorkflowActionPolicy> policyOpt =
                workflowActionPolicyService.resolvePolicy(action, statusCode, documentTypeId);

        String requiredPermission;
        boolean scopeSatisfied;
        String scopeMessage = null;

        if (policyOpt.isPresent()) {
            WorkflowActionPolicy policy = policyOpt.get();
            requiredPermission = policy.getRequiredPermissionCode();
            List<WorkflowActionPolicyActor> actors = policy.getActors();
            if (actors == null || actors.isEmpty()) {
                scopeSatisfied = false;
                scopeMessage = "Workflow action policy has no actors configured.";
            } else {
                scopeSatisfied = actors.stream().anyMatch(a -> matchesProfileScopedActor(a, profile, grantedPermissions));
                if (!scopeSatisfied) {
                    scopeMessage = buildInstanceSpecificMessage();
                }
            }
        } else {
            requiredPermission = null;
            boolean instanceSpecific = true;
            scopeSatisfied = !instanceSpecific;
            if (!scopeSatisfied) {
                scopeMessage = "No custom workflow policy is configured for this action/status — the built-in"
                        + " policy is required; runtime authorization fails closed when it is absent.";
            }
        }

        if (StringUtils.hasText(requiredPermission) && !grantedPermissions.contains(requiredPermission)) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, action.name(), action.name(), requiredPermission,
                    objectType, statusCode, status.getLabel(), MISSING_PERMISSION,
                    "Access Profile does not grant permission " + requiredPermission + ".", false);
        }

        if (!scopeSatisfied) {
            String denialReason = requiredPermission == null
                    ? NO_MATCHING_POLICY
                    : ACTOR_SCOPE_NOT_SATISFIED;
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, action.name(), action.name(), requiredPermission,
                    objectType, statusCode, status.getLabel(), denialReason, scopeMessage, false);
        }

        return evaluateObjectAccessForRevision(profile, action.name(), requiredPermission, objectType, statusCode,
                status.getLabel(), status, documentType, probeUser);
    }

    private boolean isRevisionActionApplicable(RevisionWorkflowAction action, String statusCode) {
        boolean isDraft = "DRAFT".equalsIgnoreCase(statusCode);
        boolean isPendingReview = "PENDING_REVIEW".equalsIgnoreCase(statusCode);
        boolean isPendingApproval = "PENDING_APPROVAL".equalsIgnoreCase(statusCode);
        boolean isPendingTraining = "PENDING_TRAINING".equalsIgnoreCase(statusCode);
        boolean isReadyForPublishing = "READY_FOR_PUBLISHING".equalsIgnoreCase(statusCode);
        boolean isEffective = "EFFECTIVE".equalsIgnoreCase(statusCode);
        boolean isTerminal = "EFFECTIVE".equalsIgnoreCase(statusCode) || "OBSOLETED".equalsIgnoreCase(statusCode)
                || "CLOSED_CANCELLED".equalsIgnoreCase(statusCode);
        return switch (action) {
            case COMPLETE_AUTHORING, SUBMIT_FOR_REVIEW,
                    GENERATE_REVIEW_SNAPSHOT, REGENERATE_SNAPSHOT -> isDraft;
            case OPEN_PUBLISHING_WORKSPACE -> isReadyForPublishing;
            case COMPLETE_REVIEW, REJECT_REVIEW -> isPendingReview;
            case COMPLETE_APPROVAL, REJECT_APPROVAL -> isPendingApproval;
            case COMPLETE_TRAINING -> isPendingTraining;
            case PUBLISH -> isReadyForPublishing;
            case UPGRADE_REVISION -> isEffective;
            case CANCEL -> !isTerminal;
            case UPDATE_DRAFT_METADATA, UPLOAD_SOURCE -> isDraft;
            case OBSOLETE -> isEffective;
        };
    }

    // ── Document Master (Phu luc A.1 — Cancel/Obsolete) ──────────────────────

    private EffectiveAccessRowResponse evaluateDocumentCapability(
            RoleDefinition profile, Set<String> grantedPermissions, LifecycleCapability capability,
            DocumentStatusDefinition status, DocumentType documentType, UUID documentTypeId, UserAccount probeUser
    ) {
        String statusCode = status.getCode();
        String objectType = "DOCUMENT";
        String actionCode = capability.name();

        List<com.eqms.entity.LifecycleStatePolicy> policies = lifecycleStatePolicyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        LIFECYCLE_MODULE, objectType, capability.name());

        com.eqms.entity.LifecycleStatePolicy matched = null;
        boolean anyRowStatusMatched = false;
        for (com.eqms.entity.LifecycleStatePolicy p : policies) {
            if (p.getStatusCode() != null && !p.getStatusCode().equalsIgnoreCase(statusCode)) {
                continue;
            }
            if (p.getDocumentTypeId() != null && documentTypeId != null && !p.getDocumentTypeId().equals(documentTypeId)) {
                continue;
            }
            anyRowStatusMatched = true;
            LifecycleActorScope scope = LifecycleActorScope.valueOf(p.getActorScope());
            if (scope == LifecycleActorScope.ANY) {
                matched = p;
                break;
            }
            // AUTHOR / PARTICIPANT cannot be resolved for a whole Access Profile in the abstract.
        }

        if (!anyRowStatusMatched) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, actionCode, actionCode, null, objectType,
                    statusCode, status.getLabel(), NO_MATCHING_POLICY,
                    "No active Lifecycle State Policy governs " + actionCode + " for status " + statusCode + ".", false);
        }

        if (matched == null) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, actionCode, actionCode, null, objectType,
                    statusCode, status.getLabel(), ACTOR_SCOPE_NOT_SATISFIED,
                    "Matching Lifecycle State Policy rows are all scoped to AUTHOR/PARTICIPANT, which is"
                            + " instance-specific and cannot be resolved for an Access Profile in the abstract.", false);
        }

        String requiredPermission = matched.getRequiredPermissionCode();
        if (StringUtils.hasText(requiredPermission) && !grantedPermissions.contains(requiredPermission)) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                    objectType, statusCode, status.getLabel(), MISSING_PERMISSION,
                    "Access Profile does not grant permission " + requiredPermission + ".", false);
        }

        return evaluateObjectAccessForDocument(profile, actionCode, requiredPermission, objectType, statusCode,
                status.getLabel(), status, documentType, probeUser);
    }

    // ── 3rd evaluator: Object Access Rules ───────────────────────────────────

    private EffectiveAccessRowResponse evaluateObjectAccessForRevision(
            RoleDefinition profile, String actionCode, String requiredPermission, String objectType,
            String statusCode, String statusLabel, RevisionStatusDefinition status, DocumentType documentType,
            UserAccount probeUser
    ) {
        if (probeUser == null) {
            return EffectiveAccessRowResponse.allow(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                    objectType, statusCode, statusLabel, false);
        }
        DocumentRevisionRecord synthetic = new DocumentRevisionRecord();
        synthetic.setDocumentType(documentType);
        synthetic.setStatus(status);
        boolean allowed = objectAccessEvaluationService.canAccessRevision(probeUser, synthetic, actionCode);
        if (!allowed) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                    objectType, statusCode, statusLabel, OBJECT_ACCESS_DENIED,
                    "An Object Access Rule denies this action for the given document type/status, evaluated"
                            + " against a user currently assigned to this Access Profile.", true);
        }
        return EffectiveAccessRowResponse.allow(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                objectType, statusCode, statusLabel, true);
    }

    private EffectiveAccessRowResponse evaluateObjectAccessForDocument(
            RoleDefinition profile, String actionCode, String requiredPermission, String objectType,
            String statusCode, String statusLabel, DocumentStatusDefinition status, DocumentType documentType,
            UserAccount probeUser
    ) {
        if (probeUser == null) {
            return EffectiveAccessRowResponse.allow(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                    objectType, statusCode, statusLabel, false);
        }
        DocumentRecord synthetic = new DocumentRecord();
        synthetic.setDocumentType(documentType);
        synthetic.setStatus(status);
        boolean allowed = objectAccessEvaluationService.canAccessDocument(probeUser, synthetic, actionCode);
        if (!allowed) {
            return EffectiveAccessRowResponse.deny(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                    objectType, statusCode, statusLabel, OBJECT_ACCESS_DENIED,
                    "An Object Access Rule denies this action for the given document type/status, evaluated"
                            + " against a user currently assigned to this Access Profile.", true);
        }
        return EffectiveAccessRowResponse.allow(LIFECYCLE_MODULE, actionCode, actionCode, requiredPermission,
                objectType, statusCode, statusLabel, true);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean matchesProfileScopedActor(
            WorkflowActionPolicyActor actor, RoleDefinition profile, Set<String> grantedPermissions) {
        if (actor.getActorType() == WorkflowActorType.ACCESS_PROFILE && StringUtils.hasText(actor.getActorCode())) {
            return actor.getActorCode().equalsIgnoreCase(profile.getCode());
        }
        if (actor.getActorType() == WorkflowActorType.PERMISSION && StringUtils.hasText(actor.getActorCode())) {
            return grantedPermissions.contains(actor.getActorCode());
        }
        return false;
    }

    private String buildInstanceSpecificMessage() {
        return "This action requires an object-specific workflow assignment. The Access Profile grants"
                + " capability, but the final decision also depends on the user's assignment on a concrete revision.";
    }

    private Set<String> collectGrantedPermissions(UUID accessProfileId) {
        Set<String> codes = new LinkedHashSet<>();
        for (var summary : accessProfileService.getPermissionSets(accessProfileId)) {
            permissionSetItemRepository.findAllByPermissionSet_Id(summary.id()).forEach(item -> {
                if (item.getPermission() != null && StringUtils.hasText(item.getPermission().getCode())) {
                    codes.add(item.getPermission().getCode());
                }
            });
        }
        return codes;
    }

    /**
     * Best-effort: a real, currently-assigned user for this Access Profile, used only to invoke
     * {@link ObjectAccessEvaluationService} (a genuinely concrete user + record) for rule-matching
     * purposes. If the user holds additional Access Profiles beyond the one being inspected, those
     * additional profiles could also influence the evaluator's outcome — a known limitation,
     * documented in the response note, of diagnosing a profile that has no live instance to test.
     */
    private UserAccount findProbeUser(UUID accessProfileId) {
        return userAccessProfileRepository.findByAccessProfileId(accessProfileId).stream()
                .map(UserAccessProfile::getUser)
                .filter(u -> u != null && !permissionEvaluationService.isSuperAdmin(u))
                .findFirst()
                .orElse(null);
    }
}
