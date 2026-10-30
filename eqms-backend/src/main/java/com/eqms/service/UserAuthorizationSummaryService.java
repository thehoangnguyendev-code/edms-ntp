package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.UserAuthorizationSummaryResponse;
import com.eqms.dto.user.UserAuthorizationPageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.AccessProfileWorkflowRoleRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class UserAuthorizationSummaryService {
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final EffectivePermissionService effectivePermissionService;
    private final UserAccountRepository userRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final AccessProfilePermissionSetRepository profilePermissionSetRepository;
    private final AccessProfileWorkflowRoleRepository profileWorkflowRoleRepository;
    private final PermissionSetRepository permissionSetRepository;
    private final com.eqms.repository.WorkflowRoleRepository workflowRoleRepository;

    public UserAuthorizationSummaryService(
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            EffectivePermissionService effectivePermissionService,
            UserAccountRepository userRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            AccessProfilePermissionSetRepository profilePermissionSetRepository,
            AccessProfileWorkflowRoleRepository profileWorkflowRoleRepository,
            PermissionSetRepository permissionSetRepository,
            com.eqms.repository.WorkflowRoleRepository workflowRoleRepository) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.effectivePermissionService = effectivePermissionService;
        this.userRepository = userRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.profilePermissionSetRepository = profilePermissionSetRepository;
        this.profileWorkflowRoleRepository = profileWorkflowRoleRepository;
        this.permissionSetRepository = permissionSetRepository;
        this.workflowRoleRepository = workflowRoleRepository;
    }

    public UserAuthorizationSummaryResponse getSummary(UUID userId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        boolean self = actor.getId() != null && actor.getId().equals(userId);
        if (!self && !permissionEvaluationService.hasPermission(actor, "settings.user.view")) {
            throw new AccessDeniedException("User view permission required");
        }
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<UserAuthorizationSummaryResponse.AccessProfile> profiles = userAccessProfileRepository.findByUserId(userId).stream()
                .map(assignment -> assignment.getAccessProfile())
                .filter(profile -> profile != null)
                .sorted(Comparator.comparing(RoleDefinition::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toProfile)
                .toList();

        return new UserAuthorizationSummaryResponse(
                user.getId(),
                profiles,
                effectivePermissionService.getEffectivePermissionCodes(user).size());
    }

    public UserAuthorizationPageResponse querySummary(UUID userId, String search, int page, int limit) {
        // The legacy explanation enforces self/user-view access before any query or count.
        var summary = getSummary(userId);
        String needle = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
        var labels = workflowRoleRepository.findAllByOrderByDisplayOrderAscLabelAsc().stream()
                .collect(java.util.stream.Collectors.toMap(r -> r.getCode(), r -> r.getLabel(), (a, b) -> a));
        var matching = summary.accessProfiles().stream().filter(p -> needle.isEmpty()
                || matches(p.name(), needle) || matches(p.code(), needle)
                || p.permissionSets().stream().anyMatch(s -> matches(s.name(), needle))
                || p.workflowRoles().stream().anyMatch(r -> matches(labels.getOrDefault(r, r), needle))).toList();
        int safePage = Math.max(1, page), safeLimit = Math.max(1, Math.min(100, limit));
        int start = (int) Math.min((long) (safePage - 1) * safeLimit, matching.size());
        return new UserAuthorizationPageResponse(summary.userId(), matching.subList(start, Math.min(start + safeLimit, matching.size())),
                summary.effectivePermissionCount(), summary.accessProfiles().stream().map(p -> p.id()).toList(),
                new PaginationResponse(safePage, safeLimit, matching.size(), (int) Math.ceil((double) matching.size() / safeLimit)));
    }

    private static boolean matches(String value, String needle) {
        return value != null && value.toLowerCase(java.util.Locale.ROOT).contains(needle);
    }

    private UserAuthorizationSummaryResponse.AccessProfile toProfile(RoleDefinition profile) {
        List<String> workflowRoles = profileWorkflowRoleRepository.findByAccessProfileId(profile.getId()).stream()
                .map(link -> link.getWorkflowRole())
                .filter(role -> role != null && !role.isBlank())
                .sorted()
                .toList();
        List<UserAuthorizationSummaryResponse.PermissionSet> permissionSets = profilePermissionSetRepository
                .findByAccessProfileId(profile.getId()).stream()
                .map(link -> permissionSetRepository.findById(link.getPermissionSetId()).orElse(null))
                .filter(set -> set != null)
                .sorted(Comparator.comparing(PermissionSet::getName, String.CASE_INSENSITIVE_ORDER))
                .map(set -> new UserAuthorizationSummaryResponse.PermissionSet(
                        set.getId(), set.getCode(), set.getName(), set.isActive(), permissionSetRepository.countItemsById(set.getId())))
                .toList();
        return new UserAuthorizationSummaryResponse.AccessProfile(
                profile.getId(), profile.getCode(), profile.getName(), profile.isActive(),
                profile.getBusinessUnitScope(), profile.getDepartmentScope(), workflowRoles, permissionSets);
    }
}
