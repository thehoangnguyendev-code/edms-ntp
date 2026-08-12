package com.eqms.service.workflow;

import com.eqms.enums.WorkflowActorType;
import com.eqms.exception.WorkflowPolicyException;
import org.springframework.stereotype.Service;

import java.util.*;

/** Aggregates workflow metadata contributed by feature-owned providers. */
@Service
public class WorkflowRegistryService {
    private final List<WorkflowDefinition> definitions;
    private final Map<String, WorkflowDefinition> byWorkflowKey;

    public WorkflowRegistryService(List<WorkflowDefinitionProvider> providers) {
        List<WorkflowDefinition> registered = providers.stream()
                .flatMap(provider -> provider.getWorkflowDefinitions().stream())
                .toList();

        Map<String, WorkflowDefinition> indexed = new LinkedHashMap<>();
        for (WorkflowDefinition definition : registered) {
            WorkflowDefinition previous = indexed.putIfAbsent(definition.workflowKey(), definition);
            if (previous != null) {
                throw new IllegalStateException("Duplicate workflow registry key: " + definition.workflowKey());
            }
        }
        this.definitions = List.copyOf(registered);
        this.byWorkflowKey = Collections.unmodifiableMap(indexed);
    }

    public List<WorkflowDefinition> getDefinitions() {
        return definitions;
    }

    public Optional<WorkflowDefinition.WorkflowActionDefinition> findAction(String workflowKey, String actionCode) {
        return Optional.ofNullable(byWorkflowKey.get(workflowKey))
                .flatMap(definition -> definition.actions().stream()
                        .filter(action -> action.actionCode().equals(actionCode))
                        .findFirst());
    }

    public WorkflowDefinition.WorkflowActionDefinition requireAction(
            String moduleKey, String workflowKey, String objectType, String actionCode) {
        WorkflowDefinition definition = byWorkflowKey.get(workflowKey);
        if (definition == null || !definition.moduleKey().equals(moduleKey)) {
            throw WorkflowPolicyException.validationError("Workflow is not registered: " + workflowKey);
        }
        WorkflowDefinition.WorkflowActionDefinition action = findAction(workflowKey, actionCode)
                .orElseThrow(() -> WorkflowPolicyException.validationError(
                        "Action is not registered for workflow " + workflowKey + ": " + actionCode));
        if (!action.objectType().equals(objectType)) {
            throw WorkflowPolicyException.validationError(
                    "Object type " + objectType + " is not valid for " + workflowKey + "/" + actionCode);
        }
        return action;
    }

    public Set<WorkflowActorType> getAllowedActorTypes(String workflowKey, String actionCode) {
        return findAction(workflowKey, actionCode)
                .map(WorkflowDefinition.WorkflowActionDefinition::allowedActorTypes)
                .orElse(Collections.emptySet());
    }

    /** A fallback must be explicitly declared by the owning module. */
    public boolean hasRuntimeFallback(String workflowKey, String actionCode) {
        WorkflowDefinition definition = byWorkflowKey.get(workflowKey);
        return definition != null && definition.runtimeFallbackActionCodes().contains(actionCode);
    }
}
