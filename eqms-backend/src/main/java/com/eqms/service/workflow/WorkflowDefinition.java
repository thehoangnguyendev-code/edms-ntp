package com.eqms.service.workflow;

import com.eqms.enums.WorkflowActorType;

import java.util.List;
import java.util.Set;

/** Immutable metadata exposed by a business module to Workflow Security. */
public record WorkflowDefinition(
        String moduleKey,
        String workflowKey,
        String label,
  List<WorkflowActionDefinition> actions,
  Set<String> runtimeFallbackActionCodes
) {
    public record WorkflowActionDefinition(
            String actionCode,
            String label,
            String objectType,
            Set<WorkflowActorType> allowedActorTypes,
            List<String> defaultFromStatuses,
            List<String> requiredPermissionCandidates
    ) {}
}
