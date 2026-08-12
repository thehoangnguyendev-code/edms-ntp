package com.eqms.dto.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record WorkflowActionPolicyOverrideRequest(
        @NotNull UUID documentTypeId,
        Integer priority,
        String description,
        String requiredPermissionCode,
        @Valid List<WorkflowActionPolicyActorRequest> actors,
        String changeReason,
        String signatureToken
) {
    /** Backward-compatible constructor without signature token. */
    public WorkflowActionPolicyOverrideRequest(UUID documentTypeId, Integer priority, String description,
            String requiredPermissionCode, List<WorkflowActionPolicyActorRequest> actors, String changeReason) {
        this(documentTypeId, priority, description, requiredPermissionCode, actors, changeReason, null);
    }
}
