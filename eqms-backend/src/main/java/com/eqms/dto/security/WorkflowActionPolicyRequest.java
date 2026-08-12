package com.eqms.dto.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record WorkflowActionPolicyRequest(
        @NotBlank String requiredPermissionCode,
        @NotNull Integer priority,
        @NotNull Boolean active,
        String description,
        UUID documentTypeId,
        @NotEmpty @Valid List<WorkflowActionPolicyActorRequest> actors,
        String changeReason,
        String signatureToken
) {
    /** Backward-compatible constructor without signature token. */
    public WorkflowActionPolicyRequest(String requiredPermissionCode, Integer priority, Boolean active,
            String description, UUID documentTypeId, List<WorkflowActionPolicyActorRequest> actors,
            String changeReason) {
        this(requiredPermissionCode, priority, active, description, documentTypeId, actors, changeReason, null);
    }
}
