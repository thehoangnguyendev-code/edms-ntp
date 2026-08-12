package com.eqms.service.workflow;

import java.util.List;

/**
 * Extension point for a feature that owns one or more executable workflows.
 * Adding a module provider makes its workflow metadata available to Workflow Security
 * without modifying the central policy service.
 */
public interface WorkflowDefinitionProvider {
    List<WorkflowDefinition> getWorkflowDefinitions();
}
