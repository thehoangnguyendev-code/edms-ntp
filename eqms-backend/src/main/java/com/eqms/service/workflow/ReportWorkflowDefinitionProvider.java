package com.eqms.service.workflow;

import com.eqms.enums.WorkflowActorType;
import com.eqms.service.WorkflowActionDefaultPolicyRegistry;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Arrays;
import java.util.Set;

/**
 * The workflow metadata of the Report module (phase B of AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15): the review of a report template, so that Workflow Authorization,
 * the Policy Resolver and Engine Diagnostics list it beside Document Control. Four actions from Pending Approval; the GMP variants are chosen by the engine
 * (ReportTemplateResourceAdapter.resolveVariant) when the template is, or the revision under review makes it, a GMP template. Report owns this definition, as Documents owns its own.
 */
@Component
public class ReportWorkflowDefinitionProvider implements WorkflowDefinitionProvider {
    public static final String MODULE = "REPORT";
    public static final String WORKFLOW = "REPORT_TEMPLATE";
    public static final String OBJECT_TYPE = "REPORT_TEMPLATE";

    @Override
    public List<WorkflowDefinition> getWorkflowDefinitions() {
        List<WorkflowDefinition.WorkflowActionDefinition> actions = WorkflowActionDefaultPolicyRegistry.allReportTemplate().stream()
                .map(policy -> new WorkflowDefinition.WorkflowActionDefinition(
                        policy.actionCode(),
                        toLabel(policy.actionCode()),
                        OBJECT_TYPE,
                        // permission and the relations (a person kept apart); no Access Profile or participant actor is part of the review
                        Set.copyOf(EnumSet.of(WorkflowActorType.PERMISSION)),
                        List.of(policy.fromStatus()),
                        List.of(policy.requiredPermissionCode())))
                .toList();
        return List.of(new WorkflowDefinition(MODULE, WORKFLOW, "Report Template Review", actions, Set.of()));
    }

    private static String toLabel(String code) {
        return Arrays.stream(code.toLowerCase(Locale.ROOT).split("_"))
                .map(word -> Character.toUpperCase(word.charAt(0)) + word.substring(1))
                .collect(java.util.stream.Collectors.joining(" "));
    }
}
