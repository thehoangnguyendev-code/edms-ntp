package com.eqms.service.workflow;

import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.WorkflowActorType;
import com.eqms.service.WorkflowActionDefaultPolicyRegistry;
import org.springframework.stereotype.Component;

import java.util.*;

/** Documents owns its workflow metadata; Workflow Security consumes it through the provider SPI. */
@Component
public class DocumentsWorkflowDefinitionProvider implements WorkflowDefinitionProvider {
    private static final String MODULE = "DOCUMENT_CONTROL";
    private static final String REVISION = "DOCUMENT_REVISION";
    private static final String DOCUMENT = "DOCUMENT";
    private static final String CONTROLLED_COPY = "CONTROLLED_COPY";

    private static final Set<String> BATCH_ACTIONS = Set.of("DISTRIBUTE_BATCH", "RECALL_BATCH");

    @Override
    public List<WorkflowDefinition> getWorkflowDefinitions() {
        return List.of(
                new WorkflowDefinition(MODULE, DOCUMENT, "Document Master", documentActions(),
                        WorkflowActionDefaultPolicyRegistry.allDocument().stream()
                                .map(WorkflowActionDefaultPolicyRegistry.DefaultPolicy::actionCode)
                                .collect(java.util.stream.Collectors.toUnmodifiableSet())),
                new WorkflowDefinition(MODULE, REVISION, "Document Revision", revisionActions(),
                        WorkflowActionDefaultPolicyRegistry.all().stream()
                                .map(WorkflowActionDefaultPolicyRegistry.DefaultPolicy::actionCode)
                                .collect(java.util.stream.Collectors.toUnmodifiableSet())),
                new WorkflowDefinition(MODULE, CONTROLLED_COPY, "Controlled Copy", controlledCopyActions(),
                        WorkflowActionDefaultPolicyRegistry.allControlledCopy().stream()
                                .map(WorkflowActionDefaultPolicyRegistry.DefaultPolicy::actionCode)
                                .collect(java.util.stream.Collectors.toUnmodifiableSet()))
        );
    }

    private List<WorkflowDefinition.WorkflowActionDefinition> documentActions() {
        Set<WorkflowActorType> workspaceManagers = EnumSet.of(WorkflowActorType.PERMISSION,
                WorkflowActorType.ACCESS_PROFILE);
        return WorkflowActionDefaultPolicyRegistry.allDocument().stream()
                .map(policy -> actionDefinition(policy.actionCode(), "DOCUMENT", workspaceManagers,
                        WorkflowActionDefaultPolicyRegistry.allDocument()))
                .toList();
    }

    private List<WorkflowDefinition.WorkflowActionDefinition> revisionActions() {
        Set<WorkflowActorType> workspaceManagers = EnumSet.of(WorkflowActorType.PERMISSION,
                WorkflowActorType.ACCESS_PROFILE);
        Map<String, Set<WorkflowActorType>> actors = new HashMap<>();
        actors.put("UPDATE_DRAFT_METADATA", workspaceManagers);
        actors.put("UPLOAD_SOURCE", EnumSet.of(WorkflowActorType.AUTHOR));
        actors.put("COMPLETE_AUTHORING", EnumSet.of(WorkflowActorType.AUTHOR));
        actors.put("OPEN_PUBLISHING_WORKSPACE", workspaceManagers);
        actors.put("SUBMIT_FOR_REVIEW", workspaceManagers);
        actors.put("GENERATE_REVIEW_SNAPSHOT", workspaceManagers);
        actors.put("REGENERATE_SNAPSHOT", workspaceManagers);
        actors.put("COMPLETE_REVIEW", EnumSet.of(WorkflowActorType.ASSIGNED_REVIEWER));
        actors.put("REJECT_REVIEW", EnumSet.of(WorkflowActorType.ASSIGNED_REVIEWER));
        actors.put("COMPLETE_APPROVAL", EnumSet.of(WorkflowActorType.ASSIGNED_APPROVER));
        actors.put("REJECT_APPROVAL", EnumSet.of(WorkflowActorType.ASSIGNED_APPROVER));
        actors.put("COMPLETE_TRAINING", workspaceManagers);
        actors.put("PUBLISH", workspaceManagers);
        Set<WorkflowActorType> draftCancellationActors = EnumSet.copyOf(workspaceManagers);
        draftCancellationActors.add(WorkflowActorType.AUTHOR);
        draftCancellationActors.add(WorkflowActorType.CO_AUTHOR);
        actors.put("CANCEL", draftCancellationActors);
        actors.put("OBSOLETE", workspaceManagers);
        Set<WorkflowActorType> upgradeActors = EnumSet.copyOf(workspaceManagers);
        upgradeActors.add(WorkflowActorType.AUTHOR);
        actors.put("UPGRADE_REVISION", upgradeActors);
        return Arrays.stream(RevisionWorkflowAction.values())
                .filter(action -> actors.containsKey(action.name()))
                .map(action -> actionDefinition(action.name(), "REVISION", actors.getOrDefault(action.name(), Collections.emptySet()), WorkflowActionDefaultPolicyRegistry.all()))
                .toList();
    }

    private List<WorkflowDefinition.WorkflowActionDefinition> controlledCopyActions() {
        Set<WorkflowActorType> workspaceManagers = EnumSet.of(WorkflowActorType.PERMISSION,
                WorkflowActorType.ACCESS_PROFILE);
        Set<WorkflowActorType> workspaceManagersOwner = EnumSet.copyOf(workspaceManagers);
        workspaceManagersOwner.add(WorkflowActorType.OWNER);
        Set<WorkflowActorType> workspaceManagersViewerOwner = EnumSet.copyOf(workspaceManagersOwner);
        workspaceManagersViewerOwner.add(WorkflowActorType.RECIPIENT);
        return Arrays.stream(ControlledCopyWorkflowAction.values())
                // Batch distribution is an operation on a set of controlled copies; it is not
                // a separate user-facing lifecycle. Keep one Controlled Copy workflow matrix.
                .map(action -> actionDefinition(action.name(), "CONTROLLED_COPY",
                        switch (action) {
                            case VIEW_COPY, PREVIEW_FILE, DOWNLOAD_FILE, PRINT_COPY -> workspaceManagersViewerOwner;
                            case REPORT_LOST_DAMAGED, UPLOAD_EVIDENCE -> workspaceManagersOwner;
                            default -> workspaceManagers;
                        },
                        WorkflowActionDefaultPolicyRegistry.allControlledCopy()))
                .toList();
    }

    private WorkflowDefinition.WorkflowActionDefinition actionDefinition(
            String actionCode, String objectType, Set<WorkflowActorType> actorTypes,
            Collection<WorkflowActionDefaultPolicyRegistry.DefaultPolicy> defaults) {
        List<WorkflowActionDefaultPolicyRegistry.DefaultPolicy> matching = defaults.stream()
                .filter(policy -> policy.actionCode().equals(actionCode))
                .toList();
        return new WorkflowDefinition.WorkflowActionDefinition(
                actionCode,
                toLabel(actionCode),
                objectType,
                Set.copyOf(actorTypes),
                matching.stream().map(WorkflowActionDefaultPolicyRegistry.DefaultPolicy::fromStatus).distinct().toList(),
                matching.stream().map(WorkflowActionDefaultPolicyRegistry.DefaultPolicy::requiredPermissionCode).distinct().toList()
        );
    }

    private String toLabel(String code) {
        return Arrays.stream(code.toLowerCase(Locale.ROOT).split("_"))
                .map(word -> Character.toUpperCase(word.charAt(0)) + word.substring(1))
                .collect(java.util.stream.Collectors.joining(" "));
    }
}
