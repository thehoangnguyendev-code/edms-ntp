package com.eqms.dto.security;

import com.eqms.i18n.LocalizedMessageResolver;
import com.eqms.enums.ControlledCopyWorkflowAction;

public record ControlledCopyAuthorizationDecision(
        boolean allowed,
        String reasonCode,
        String message,
        String requiredPermissionCode,
        ControlledCopyWorkflowAction action,
        String objectType,
        String status
) {
    public static ControlledCopyAuthorizationDecision allowed(
            ControlledCopyWorkflowAction action,
            String objectType,
            String status,
            String requiredPermissionCode
    ) {
        return new ControlledCopyAuthorizationDecision(true, null, null, requiredPermissionCode, action, objectType, status);
    }

    public static ControlledCopyAuthorizationDecision denied(
            ControlledCopyWorkflowAction action,
            String objectType,
            String status,
            String reasonCode,
            String message,
            String requiredPermissionCode
    ) {
        return new ControlledCopyAuthorizationDecision(false, reasonCode,
                LocalizedMessageResolver.resolve("authorization", reasonCode, message), requiredPermissionCode, action, objectType, status);
    }
}
