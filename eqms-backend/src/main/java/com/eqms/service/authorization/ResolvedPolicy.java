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
 */
public record ResolvedPolicy(
        String requiredPermissionCode,
        Long policyVersion,
        List<String> requiredRelationCodes,
        String relationMatchRule
) {
    public ResolvedPolicy {
        if (requiredRelationCodes == null) requiredRelationCodes = List.of();
        if (relationMatchRule == null) relationMatchRule = "ANY";
    }
}
