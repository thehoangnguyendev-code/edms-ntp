package com.eqms.dto.security;

import java.util.Set;
import java.util.UUID;

public record AuthorizationDecision(
        boolean allowed,
        String reasonCode,
        String message,
        String permissionCode,
        String objectType,
        UUID objectId,
        boolean systemSuperAdmin,
        boolean legacyFallbackUsed,
        Set<String> effectivePermissionCodes
) {
    public static AuthorizationDecision allowed(String permissionCode, boolean systemSuperAdmin, boolean legacyFallback, Set<String> codes) {
        return new AuthorizationDecision(true, systemSuperAdmin ? "SYSTEM_SUPER_ADMIN_ALLOWED" : "PERMISSION_GRANTED",
                null, permissionCode, null, null, systemSuperAdmin, legacyFallback, codes);
    }

    public static AuthorizationDecision denied(String reasonCode, String message, String permissionCode,
                                                String objectType, UUID objectId) {
        return new AuthorizationDecision(false, reasonCode, message, permissionCode, objectType, objectId,
                false, false, Set.of());
    }
}
