package com.eqms.dto.security;

/**
 * One row of the EffectiveAccessPanel matrix (Phase 3): a single capability/action evaluated
 * against a single lifecycle status for a given Access Profile.
 *
 * {@code reasonCode} is one of exactly 4 values (null when {@code allowed} is true):
 * MISSING_PERMISSION, ACTOR_SCOPE_NOT_SATISFIED, OBJECT_ACCESS_DENIED, NO_MATCHING_POLICY.
 */
public record EffectiveAccessRowResponse(
        String moduleKey,
        String actionCode,
        String actionLabel,
        String requiredPermissionCode,
        String objectType,
        String statusCode,
        String statusLabel,
        boolean allowed,
        String reasonCode,
        String message,
        boolean objectAccessRuleEvaluated
) {
    public static EffectiveAccessRowResponse allow(
            String moduleKey, String actionCode, String actionLabel, String requiredPermissionCode,
            String objectType, String statusCode, String statusLabel, boolean objectAccessRuleEvaluated
    ) {
        return new EffectiveAccessRowResponse(moduleKey, actionCode, actionLabel, requiredPermissionCode,
                objectType, statusCode, statusLabel, true, null, null, objectAccessRuleEvaluated);
    }

    public static EffectiveAccessRowResponse deny(
            String moduleKey, String actionCode, String actionLabel, String requiredPermissionCode,
            String objectType, String statusCode, String statusLabel,
            String reasonCode, String message, boolean objectAccessRuleEvaluated
    ) {
        return new EffectiveAccessRowResponse(moduleKey, actionCode, actionLabel, requiredPermissionCode,
                objectType, statusCode, statusLabel, false, reasonCode, message, objectAccessRuleEvaluated);
    }
}
