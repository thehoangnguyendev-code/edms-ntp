package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.UserAuthorizationSummaryResponse;
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

    public UserAuthorizationSummaryService(
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            EffectivePermissionService effectivePermissionService,
            UserAccountRepository userRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            AccessProfilePermissionSetRepository profilePermissionSetRepository,
            AccessProfileWorkflowRoleRepository profileWorkflowRoleRepository,
            PermissionSetRepository permissionSetRepository) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.effectivePermissionService = effectivePermissionService;
        this.userRepository = userRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.profilePermissionSetRepository = profilePermissionSetRepository;
        this.profileWorkflowRoleRepository = profileWorkflowRoleRepository;
        this.permissionSetRepository = permissionSetRepository;
    }

    public UserAuthorizationSummaryResponse getSummary(UUID userId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        boolean self = actor.getId() != null && actor.getId().equals(userId);
        if (!self && !permissionEvaluationService.isSuperAdmin(actor)
                && !permissionEvaluationService.hasPermission(actor, "settings.user.view")) {
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
