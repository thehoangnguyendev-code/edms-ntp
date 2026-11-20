package com.eqms.service.workflow;

import com.eqms.enums.WorkflowActorType;
import com.eqms.service.WorkflowActionDefaultPolicyRegistry;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The workflow metadata of every module that has joined the engine after Document Control and Report: Training, Backup & Restore, Access Review, Audit Review... (phases C and after of
 * AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15). Built from the registry of defaults, so the list in Workflow Authorization, the reset of a policy and the migration that seeds it agree. A
 * module owns its policies (its rows in the registry); this class only reads them.
 */
@Component
public class ModuleWorkflowDefinitionProvider implements WorkflowDefinitionProvider {

    @Override
    public List<WorkflowDefinition> getWorkflowDefinitions() {
        Map<String, List<WorkflowActionDefaultPolicyRegistry.ModuleDefault>> byWorkflow = new LinkedHashMap<>();
        for (var d : WorkflowActionDefaultPolicyRegistry.allModule()) byWorkflow.computeIfAbsent(d.moduleKey() + "|" + d.workflowKey(), k -> new ArrayList<>()).add(d);
        List<WorkflowDefinition> out = new ArrayList<>();
        byWorkflow.values().forEach(defaults -> {
            Map<String, List<WorkflowActionDefaultPolicyRegistry.ModuleDefault>> byAction = new LinkedHashMap<>();
            for (var d : defaults) byAction.computeIfAbsent(d.policy().actionCode(), k -> new ArrayList<>()).add(d);
            List<WorkflowDefinition.WorkflowActionDefinition> actions = new ArrayList<>();
            byAction.forEach((action, rows) -> actions.add(new WorkflowDefinition.WorkflowActionDefinition(
                    action,
                    prettify(action),
                    rows.getFirst().objectType(),
                    Set.copyOf(EnumSet.of(WorkflowActorType.PERMISSION)),
                    rows.stream().map(r -> r.policy().fromStatus()).distinct().toList(),
                    rows.stream().map(r -> r.policy().requiredPermissionCode()).filter(c -> !c.isBlank()).distinct().toList())));
            var first = defaults.getFirst();
            out.add(new WorkflowDefinition(first.moduleKey(), first.workflowKey(), prettify(first.workflowKey()), actions, Set.of()));
        });
        return out;
    }

    static String prettify(String code) {
        return Arrays.stream(code.toLowerCase(Locale.ROOT).split("_"))
                .map(word -> word.isEmpty() ? word : Character.toUpperCase(word.charAt(0)) + word.substring(1))
                .collect(java.util.stream.Collectors.joining(" "));
    }
}
