package com.eqms.service.authorization;

import java.util.List;

/**
 * Policy resolved by a {@link ResourceAuthorizationAdapter} for one (action, state, documentType).
 * Each resource type owns how it resolves this -- {@code workflow_action_policies} for Revision,
 * {@code lifecycle_state_policies} or a direct permission check for Document Master -- the engine
 * itself no longer assumes a single policy source (found while building the Document Master
 * adapter: its real enforcement is split across three different mechanisms, none of which is the
 * generic workflow_action_policies table the engine originally hardcoded).
 *
 * @param requiredPermissionCode RBAC permission gate, or null/blank if none required.
 * @param policyVersion Version of the underlying policy row, for the decision's audit trail. Null
 *                       if the policy source has no versioning concept.
 * @param requiredRelationCodes Relation codes (from {@code authorization_relation_definitions})
 *                               the actor must satisfy, per {@code relationMatchRule}. Empty means
 *                               no relation requirement -- permission alone suffices.
 * @param relationMatchRule "ANY" or "ALL".
 * @param forbiddenRelationCodes Relation codes the actor must NOT satisfy for this resource (runtime separation of duties, "a different person":
 *                               e.g. the approver of a report template must not be its author or the person who submitted it). Checked after the
 *                               required relations; a match denies with {@code SEPARATION_OF_DUTIES}. Empty means none. Added 2026-11-18 (phase A.2 of
 *                               AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN); the four-argument constructor keeps every existing adapter unchanged.
 */
public record ResolvedPolicy(
        String requiredPermissionCode,
        Long policyVersion,
        List<String> requiredRelationCodes,
        String relationMatchRule,
        List<String> forbiddenRelationCodes
) {
    public ResolvedPolicy {
        if (requiredRelationCodes == null) requiredRelationCodes = List.of();
        if (relationMatchRule == null) relationMatchRule = "ANY";
        if (forbiddenRelationCodes == null) forbiddenRelationCodes = List.of();
    }

    /** A policy with no forbidden relation: what every adapter built before the "a different person" check returns. */
    public ResolvedPolicy(String requiredPermissionCode, Long policyVersion, List<String> requiredRelationCodes, String relationMatchRule) {
        this(requiredPermissionCode, policyVersion, requiredRelationCodes, relationMatchRule, List.of());
    }
}
