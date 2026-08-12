package com.eqms.dto.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record WorkflowActionPolicyCreateRequest(
        @NotBlank String moduleKey,
        @NotBlank String workflowKey,
        @NotBlank String objectType,
        @NotBlank String actionCode,
        @NotBlank String fromStatus,
        UUID documentTypeId,
        @NotBlank String requiredPermissionCode,
        Integer priority,
        Boolean active,
        String description,
        @NotEmpty @Valid List<WorkflowActionPolicyActorRequest> actors,
        String changeReason,
        String signatureToken
) {
    /** Backward-compatible constructor without signature token. */
    public WorkflowActionPolicyCreateRequest(String moduleKey, String workflowKey, String objectType,
            String actionCode, String fromStatus, UUID documentTypeId, String requiredPermissionCode,
            Integer priority, Boolean active, String description,
            List<WorkflowActionPolicyActorRequest> actors, String changeReason) {
        this(moduleKey, workflowKey, objectType, actionCode, fromStatus, documentTypeId,
                requiredPermissionCode, priority, active, description, actors, changeReason, null);
    }
}
