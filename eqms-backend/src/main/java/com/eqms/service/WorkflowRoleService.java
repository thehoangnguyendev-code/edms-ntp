package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowRole;
import com.eqms.repository.AccessProfileWorkflowRoleRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.WorkflowRoleRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Read model for the canonical Workflow Roles: assignments (Access Profiles → users)
 * and the workflow action policies each role participates in. Roles themselves come
 * from the {@code workflow_roles} catalog table ({@link WorkflowRoleRepository}) —
 * previously a fixed enum ({@code WorkflowRoleCode}), now DB-backed and admin-extensible.
 */
@Service
public class WorkflowRoleService {

    private static final String VIEW_PERMISSION = "security.workflow_authorization.view";
    private static final String MANAGE_PERMISSION = "security.workflow_authorization.manage";

    public record WorkflowRoleProfileRef(UUID id, String name, boolean active, long assignedUsers) {}
    public record WorkflowRolePolicyRef(String actionCode, String actionLabel, String fromStatus, boolean active) {}
    public record WorkflowRoleResponse(
            String code,
            String label,
            String moduleKey,
            String description,
            List<WorkflowRoleProfileRef> assignedProfiles,
            long totalUsers,
            List<WorkflowRolePolicyRef> policies
    ) {}

    private final AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final WorkflowRoleRepository workflowRoleRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public WorkflowRoleService(
            AccessProfileWorkflowRoleRepository accessProfileWorkflowRoleRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            WorkflowRoleRepository workflowRoleRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService) {
        this.accessProfileWorkflowRoleRepository = accessProfileWorkflowRoleRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.workflowRoleRepository = workflowRoleRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @Transactional
    public List<WorkflowRoleResponse> listAll() {
        requireView();
        // WORKFLOW_ROLE was a legacy actor selector (deprecated, always fail-closed in
        // matchesActor); removed from WorkflowActorType, so no policy can reference it anymore.
        Map<String, List<WorkflowRolePolicyRef>> policiesByRole = new LinkedHashMap<>();

        List<WorkflowRole> roles = workflowRoleRepository.findAllByActiveTrueOrderByDisplayOrderAscLabelAsc();
        return roles.stream().map(role -> {
            List<WorkflowRoleProfileRef> profiles = accessProfileWorkflowRoleRepository
                    .findByWorkflowRole(role.getCode())
                    .stream()
                    .filter(link -> link.getAccessProfile() != null)
                    .map(link -> new WorkflowRoleProfileRef(
                            link.getAccessProfileId(),
                            link.getAccessProfile().getName(),
                            link.getAccessProfile().isActive(),
                            userAccessProfileRepository.countByAccessProfileId(link.getAccessProfileId())))
                    .toList();
            long totalUsers = profiles.stream().mapToLong(WorkflowRoleProfileRef::assignedUsers).sum();
            return new WorkflowRoleResponse(
                    role.getCode(), role.getLabel(), role.getModuleKey(), role.getDescription(), profiles, totalUsers,
                    policiesByRole.getOrDefault(role.getCode(), List.of()));
        }).toList();
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Workflow authorization view permission required");
        }
    }
}
