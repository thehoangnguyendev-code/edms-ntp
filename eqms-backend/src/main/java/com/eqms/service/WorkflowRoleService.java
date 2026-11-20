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

    /**
     * The workflow roles, searched, sorted and paged on the server. With `accessProfileId` only the roles that Access Profile has are
     * listed (read-only profile details); without it the whole active catalog is listed (the editor ticks from it).
     * `countForProfileId` is the Access Profile whose users the "users" sort orders by (the screen shows that profile's number);
     * without it the sort uses the users of the role across every profile.
     */
    @Transactional
    public com.eqms.dto.user.PageResponse<WorkflowRoleResponse> listPaged(
            int page, int limit, String search, String sortBy, String sortDir, UUID accessProfileId, UUID countForProfileId) {
        String term = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
        var matches = listAll().stream()
                .filter(role -> accessProfileId == null
                        || role.assignedProfiles().stream().anyMatch(profile -> accessProfileId.equals(profile.id())))
                .filter(role -> term.isEmpty() || java.util.stream.Stream.of(role.code(), role.label(), role.moduleKey(), role.description())
                        .anyMatch(value -> value != null && value.toLowerCase(java.util.Locale.ROOT).contains(term)))
                .toList();
        java.util.Comparator<WorkflowRoleResponse> byLabel = java.util.Comparator.comparing(WorkflowRoleResponse::label,
                java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
        java.util.Comparator<WorkflowRoleResponse> order = switch (sortBy == null ? "" : sortBy) {
            case "code" -> java.util.Comparator.comparing(WorkflowRoleResponse::code, java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "module" -> java.util.Comparator.comparing(WorkflowRoleResponse::moduleKey, java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "users" -> java.util.Comparator.comparingLong(role -> usersOf(role, countForProfileId));
            default -> byLabel;
        };
        if ("desc".equalsIgnoreCase(sortDir)) order = order.reversed();
        var sorted = matches.stream().sorted(order.thenComparing(byLabel)).toList();
        int safePage = Math.max(1, page), size = Math.max(1, Math.min(100, limit));
        int start = (int) Math.min((long) (safePage - 1) * size, sorted.size());
        return new com.eqms.dto.user.PageResponse<>(sorted.subList(start, Math.min(start + size, sorted.size())),
                new com.eqms.dto.user.PaginationResponse(safePage, size, sorted.size(), Math.max(1, (int) Math.ceil((double) sorted.size() / size))));
    }

    /** The users that hold this role through one Access Profile, or through every profile when none is given. */
    static long usersOf(WorkflowRoleResponse role, UUID profileId) {
        if (profileId == null) return role.totalUsers();
        return role.assignedProfiles().stream().filter(profile -> profileId.equals(profile.id()))
                .mapToLong(WorkflowRoleProfileRef::assignedUsers).sum();
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Workflow authorization view permission required");
        }
    }
}
