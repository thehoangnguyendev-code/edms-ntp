package com.eqms.service.authorization;

import com.eqms.entity.UserAccount;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Per-resource-type plug-in for {@link AuthorizationEngineService}. Each module registers exactly
 * one adapter (Spring bean implementing this interface) for the resource type it owns; the engine
 * itself never contains resource-specific logic (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7,
 * Phase 0 step 2).
 *
 * <p>Policy resolution ({@link #resolvePolicy}) is also adapter-owned, not the engine's -- found
 * while building the Document Master adapter that its real enforcement is split across three
 * different mechanisms (a direct permission check for metadata edits, {@code lifecycle_state_policies}
 * for Cancel/Obsolete, and an unused {@code workflow_action_policies} row nobody actually reads),
 * unlike Revision which is uniformly {@code workflow_action_policies}-driven. The engine no longer
 * assumes one shared policy source; each adapter faithfully mirrors whatever its module's real
 * enforcement code already reads.
 */
public interface ResourceAuthorizationAdapter {

    /** Resource type this adapter owns, e.g. "REVISION", "DOCUMENT". */
    String resourceType();

    /** Current lifecycle state code of the resource instance (e.g. "DRAFT"), or null if unknown/missing. */
    String resolveState(UUID resourceId);

    /** Document type driving a document-type-specific policy override, or null if not applicable. */
    UUID resolveDocumentTypeId(UUID resourceId);

    /**
     * Resolves the policy for one (action, state, documentType) using whichever mechanism this
     * resource type's real enforcement code actually reads. Empty means "no policy configured" --
     * the engine denies with {@code POLICY_NOT_CONFIGURED} (fail-closed), matching how the legacy
     * evaluators already behave for an unconfigured action.
     */
    Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId);

    /**
     * Codes from {@code authorization_relation_definitions} (resource_type = {@link #resourceType()})
     * that {@code actor} currently satisfies for this specific resource instance -- e.g. an actor who
     * is the assigned Author of revision R returns {"AUTHOR"}. Empty set if none match.
     */
    Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId);

    /**
     * Data scope / explicit object grant check (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §3
     * steps 4-5: Explicit Deny always wins, Explicit Allow or a matching data scope otherwise
     * required). Document/Revision adapters delegate to the existing single source of truth,
     * {@link com.eqms.service.ObjectAccessEvaluationService#canAccessDocument} /
     * {@code #canAccessRevision} -- both already implement rule-based ALLOW/DENY plus BU/Department
     * scope in one boolean, so this method is a thin passthrough, not new logic.
     */
    boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action);

    /**
     * State/attribute precondition for this (resourceId, actionCode) that does not depend on who
     * the actor is -- e.g. Revision SUBMIT_FOR_REVIEW requires {@code editingStatus == COMPLETED}
     * and {@code sourceLocked == true} regardless of whether the caller is the Author. Found during
     * Phase 1-2.4 shadow-evaluation review: these are business-rule preconditions, not actor
     * relations, so they don't belong in {@link #resolveMatchedRelations}. Returns the legacy
     * reason code (e.g. "EDITING_NOT_COMPLETED") if blocked, empty if the precondition passes or
     * this resource type has none for the given action. Default: no preconditions.
     */
    default Optional<String> checkPrecondition(UUID resourceId, String actionCode) {
        return Optional.empty();
    }

    /**
     * Optional, diagnostic-only reason code to use INSTEAD of the engine's generic
     * {@code POLICY_NOT_CONFIGURED} when {@link #resolvePolicy} returns empty. Exists because a
     * resource can legitimately have no policy row for an (action, state) pair for two very
     * different reasons -- the action was never wired up at all, or the resource is simply in a
     * terminal/invalid state for that action (e.g. Controlled Copy state {@code OBSOLETED} has no
     * {@code DOWNLOAD_FILE} policy row because downloading an obsoleted copy was never meant to be
     * possible) -- and the legacy evaluators already surface the second case with a specific reason
     * (e.g. {@code INVALID_CONTROLLED_COPY_STATE}). This narrows shadow-evaluation reason-code
     * mismatches to genuine gaps instead of every terminal-state check. Never changes the allow/deny
     * outcome (both sides already deny in this case) -- default: no adapter-specific reason.
     */
    default Optional<String> explainMissingPolicy(String actionCode, String state) {
        return Optional.empty();
    }
}
