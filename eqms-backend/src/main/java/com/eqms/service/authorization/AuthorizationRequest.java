package com.eqms.service.authorization;

import com.eqms.entity.UserAccount;

import java.util.Map;
import java.util.UUID;

/**
 * Input to {@link AuthorizationEngineService#authorize}. {@code context} carries business input
 * only (reason, e-signature token, form fields); the engine never accepts relation/scope from
 * the caller -- those are always server-resolved (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §5.3.D).
 */
public record AuthorizationRequest(
        UserAccount actor,
        String resourceType,
        UUID resourceId,
        String actionCode,
        Map<String, Object> context
) {
    public AuthorizationRequest {
        if (context == null) context = Map.of();
    }

    public static AuthorizationRequest of(UserAccount actor, String resourceType, UUID resourceId, String actionCode) {
        return new AuthorizationRequest(actor, resourceType, resourceId, actionCode, Map.of());
    }
}
