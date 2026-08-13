package com.eqms.dto.security;

import com.eqms.i18n.LocalizedMessageResolver;
import com.eqms.enums.RevisionWorkflowAction;

import java.util.UUID;

public record WorkflowAuthorizationDecision(
        boolean allowed,
        String reasonCode,
        String message,
        String permissionCode,
        RevisionWorkflowAction action,
        UUID revisionId,
        String currentStatus,
        boolean systemSuperAdmin,
        boolean legacyFallbackUsed
) {
    public static WorkflowAuthorizationDecision allowed(
            RevisionWorkflowAction action,
            UUID revisionId,
            String currentStatus,
            boolean systemSuperAdmin,
            boolean legacyFallbackUsed
    ) {
        return new WorkflowAuthorizationDecision(
                true, null, null, null, action, revisionId, currentStatus, systemSuperAdmin, legacyFallbackUsed
        );
    }

    public static WorkflowAuthorizationDecision denied(
            String reasonCode,
            String message,
            String permissionCode,
            RevisionWorkflowAction action,
            UUID revisionId,
            String currentStatus
    ) {
        return new WorkflowAuthorizationDecision(
                false, reasonCode, LocalizedMessageResolver.resolve("authorization", reasonCode, message), permissionCode, action, revisionId, currentStatus, false, false
        );
    }
}
