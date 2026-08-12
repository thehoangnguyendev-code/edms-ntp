package com.eqms.service.authorization;

import java.util.List;
import java.util.Map;

/**
 * Unified decision returned by {@link AuthorizationEngineService#authorize}.
 * See SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §3. Deliberately not named/placed alongside
 * {@code com.eqms.dto.security.AuthorizationDecision} -- that is the pre-existing, unrelated
 * general-RBAC decision type used by {@code AuthorizationService.check()} across the app.
 */
public record AuthorizationDecision(
        boolean allowed,
        String reasonCode,
        String requiredPermission,
        List<String> resolvedScopes,
        List<String> matchedRelations,
        Long matchedPolicyVersion,
        String resourceState,
        Map<String, Object> requiredControls
) {
    public static AuthorizationDecision deny(String reasonCode) {
        return new AuthorizationDecision(false, reasonCode, null, List.of(), List.of(), null, null, Map.of());
    }

    public static AuthorizationDecision deny(String reasonCode, String requiredPermission, String resourceState) {
        return new AuthorizationDecision(false, reasonCode, requiredPermission, List.of(), List.of(), null, resourceState, Map.of());
    }

    public static AuthorizationDecision allow(
            String requiredPermission,
            List<String> resolvedScopes,
            List<String> matchedRelations,
            Long matchedPolicyVersion,
            String resourceState,
            Map<String, Object> requiredControls
    ) {
        return new AuthorizationDecision(
                true, null, requiredPermission, resolvedScopes, matchedRelations,
                matchedPolicyVersion, resourceState, requiredControls
        );
    }
}
