package com.eqms.dto.security;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record WorkflowActionPolicyResponse(
        UUID id,
        String moduleKey,
        String moduleLabel,
        String workflowKey,
        String workflowLabel,
        String objectType,
        String actionCode,
        String actionLabel,
        String fromStatus,
        String fromStatusLabel,
        UUID documentTypeId,
        String documentTypeName,
        String requiredPermissionCode,
        String requiredPermissionName,
        int priority,
        boolean active,
        boolean system,
        boolean editable,
        boolean resettable,
        boolean deactivatable,
        String description,
        List<WorkflowActionPolicyActorResponse> actors,
        List<String> warnings,
        Instant createdAt,
        Instant updatedAt,
        /** New hybrid-engine relation model (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §3.1) --
         * what {@code ResourceAuthorizationAdapter}s actually read once a resource type's cutover
         * flag is on, independent of {@link #actors}. */
        String relationMatchRule,
        List<WorkflowActionPolicyRelationResponse> relations
) {}
