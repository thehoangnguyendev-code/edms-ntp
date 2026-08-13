package com.eqms.dto.security;

import com.eqms.i18n.LocalizedMessageResolver;

public record ControlledCopyActionCapabilityDecisionResponse(
        boolean allowed,
        String reasonCode,
        String message,
        String permissionCode,
        String requiredPermissionCode,
        String actionCode,
        String objectType,
        String status
) {
    public static ControlledCopyActionCapabilityDecisionResponse allow(
            String actionCode,
            String objectType,
            String status,
            String requiredPermissionCode
    ) {
        return new ControlledCopyActionCapabilityDecisionResponse(
                true,
                null,
                null,
                requiredPermissionCode,
                requiredPermissionCode,
                actionCode,
                objectType,
                status
        );
    }

    public static ControlledCopyActionCapabilityDecisionResponse deny(
            String reasonCode,
            String message,
            String requiredPermissionCode,
            String actionCode,
            String objectType,
            String status
    ) {
        return new ControlledCopyActionCapabilityDecisionResponse(
                false,
                reasonCode,
                LocalizedMessageResolver.resolve("authorization", reasonCode, message),
                requiredPermissionCode,
                requiredPermissionCode,
                actionCode,
                objectType,
                status
        );
    }
}
