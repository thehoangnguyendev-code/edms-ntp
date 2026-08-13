package com.eqms.dto.security;

import com.eqms.i18n.LocalizedMessageResolver;

public record RevisionActionCapabilityDecisionResponse(
        boolean allowed,
        String reasonCode,
        String message,
        String permissionCode,
        String requiredPermissionCode
) {
    public static RevisionActionCapabilityDecisionResponse allow(String requiredPermissionCode) {
        return new RevisionActionCapabilityDecisionResponse(true, null, null, requiredPermissionCode, requiredPermissionCode);
    }

    public static RevisionActionCapabilityDecisionResponse deny(
            String reasonCode,
            String message,
            String permissionCode
    ) {
        return new RevisionActionCapabilityDecisionResponse(false, reasonCode,
                LocalizedMessageResolver.resolve("authorization", reasonCode, message), permissionCode, permissionCode);
    }
}
