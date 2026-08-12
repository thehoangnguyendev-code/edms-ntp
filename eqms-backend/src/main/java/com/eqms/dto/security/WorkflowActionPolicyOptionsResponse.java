package com.eqms.dto.security;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record WorkflowActionPolicyOptionsResponse(
        List<String> modules,
        List<String> workflows,
        List<WorkflowOption> workflowOptions,
        List<String> objectTypes,
        List<ActionOption> actions,
        List<ActorTypeOption> actorTypes,
        List<PermissionOption> permissions,
        List<DocumentTypeOption> documentTypes,
        /** Selectable actor codes keyed by actor type. The server owns this metadata. */
        Map<String, List<ActorCodeOption>> actorCodeOptions
) {
    /** Display metadata from the feature-owned workflow registry. */
    public record WorkflowOption(String value, String label, String moduleKey) {}

    public record ActorCodeOption(String value, String label) {}

    /**
     * Describes a single (workflowKey, actionCode) combination.
     * {@code value} is the action code string.
     * {@code workflowKey} and {@code objectType} allow the frontend to filter actions
     * by the selected workflow / object-type without hardcoding any lists.
     */
    public record ActionOption(
            String value,
            String label,
            String workflowKey,
            String objectType,
            List<String> allowedActorTypes,
            List<String> defaultFromStatuses,
            List<String> requiredPermissionCandidates
    ) {}

    public record ActorTypeOption(
            String value,
            String label,
            boolean requiresActorCode
    ) {}

    public record PermissionOption(
            String code,
            String name,
            String moduleKey,
            String groupKey
    ) {}

    public record DocumentTypeOption(
            UUID id,
            String code,
            String name
    ) {}
}
