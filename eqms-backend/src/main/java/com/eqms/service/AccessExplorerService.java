package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.AccessExplorerDtos.GrantingProfile;
import com.eqms.dto.user.AccessExplorerDtos.GrantingSet;
import com.eqms.dto.user.AccessExplorerDtos.Holder;
import com.eqms.dto.user.AccessExplorerDtos.HoldersResponse;
import com.eqms.dto.user.AccessExplorerDtos.PermissionOption;
import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccessProfileRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Access Explorer (SECURITY-AUTHORIZATION-REVIEW D6, owner 2026-11-18): the question an auditor asks, "who holds this permission, and through what?", answered from the same
 * chain the sign-in uses to decide (person, active access profile, active permission set, permission), so the answer cannot differ from what the system enforces. It is read
 * only and gives nothing the user list does not already give to a person who may see users (the permissions of each person are part of that list), so it is open to the
 * same audience: whoever may view users or access profiles.
 */
@Service
public class AccessExplorerService {
    static final int MAX_PERMISSIONS = 50;

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final PermissionRepository permissionRepository;
    private final PermissionSetRepository permissionSetRepository;
    private final AccessProfilePermissionSetRepository profileSetRepository;
    private final UserAccessProfileRepository userProfileRepository;
    private final TimeLimitedUserGrantRepository timeLimitedGrantRepository;

    public AccessExplorerService(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService, PermissionRepository permissionRepository,
                                 PermissionSetRepository permissionSetRepository, AccessProfilePermissionSetRepository profileSetRepository,
                                 UserAccessProfileRepository userProfileRepository, TimeLimitedUserGrantRepository timeLimitedGrantRepository) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.permissionRepository = permissionRepository;
        this.permissionSetRepository = permissionSetRepository;
        this.profileSetRepository = profileSetRepository;
        this.userProfileRepository = userProfileRepository;
        this.timeLimitedGrantRepository = timeLimitedGrantRepository;
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, "settings.user.view", "security.access_profiles.view")) {
            throw new AccessDeniedException("Access Explorer requires permission to view users or access profiles");
        }
    }

    /** The permissions whose code, name, module or description contains the text, for the picker. At most 50; an empty text gives the first 50 by code. */
    @Transactional(readOnly = true)
    public List<PermissionOption> searchPermissions(String search) {
        requireView();
        // every word typed must be found somewhere in the permission, in any order ("paper verify" finds "Verify Paper Training")
        String[] words = search == null || search.isBlank() ? new String[0] : search.trim().toLowerCase(Locale.ROOT).split("[ \t]+");
        return permissionRepository.findAll().stream()
                .filter(p -> java.util.Arrays.stream(words).allMatch(word -> contains(p.getCode(), word) || contains(p.getName(), word) || contains(p.getModuleKey(), word)
                        || contains(p.getCategory(), word) || contains(p.getDescription(), word)))
                .sorted(Comparator.comparing(Permission::getCode, String.CASE_INSENSITIVE_ORDER))
                .limit(MAX_PERMISSIONS)
                .map(AccessExplorerService::option)
                .toList();
    }

    /**
     * Everyone who holds the permission through an ACTIVE access profile that holds an ACTIVE permission set that contains it. {@code activeOnly} keeps the people whose
     * account is Active (a suspended or terminated person holds nothing in practice). Nothing is written.
     */
    @Transactional(readOnly = true)
    public HoldersResponse whoHolds(String code, boolean activeOnly) {
        requireView();
        if (!StringUtils.hasText(code)) throw new IllegalArgumentException("A permission code is required");
        Permission permission = permissionRepository.findByCode(code.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new IllegalArgumentException("Unknown permission: " + code.trim()));

        Map<UUID, Holder> byUser = new LinkedHashMap<>();
        Map<UUID, Set<String>> profilesOf = new LinkedHashMap<>();
        Map<UUID, Set<String>> setsOf = new LinkedHashMap<>();
        Map<UUID, UserAccount> users = new LinkedHashMap<>();
        List<GrantingSet> sets = new ArrayList<>();

        for (PermissionSet set : permissionSetRepository.findActiveSetsGrantingCode(permission.getCode())) {
            List<GrantingProfile> profiles = new ArrayList<>();
            for (AccessProfilePermissionSet link : profileSetRepository.findByPermissionSetId(set.getId())) {
                RoleDefinition profile = link.getAccessProfile();
                if (profile == null || !profile.isActive()) continue;
                List<UserAccessProfile> assignments = userProfileRepository.findByAccessProfileId(profile.getId());
                profiles.add(new GrantingProfile(profile.getId(), profile.getCode(), profile.getName(), true, assignments.size()));
                for (UserAccessProfile assignment : assignments) {
                    UserAccount user = assignment.getUser();
                    if (user == null) continue;
                    users.putIfAbsent(user.getId(), user);
                    profilesOf.computeIfAbsent(user.getId(), k -> new TreeSet<>(String.CASE_INSENSITIVE_ORDER)).add(profile.getName());
                    setsOf.computeIfAbsent(user.getId(), k -> new TreeSet<>(String.CASE_INSENSITIVE_ORDER)).add(set.getName());
                }
            }
            sets.add(new GrantingSet(set.getId(), set.getCode(), set.getName(), profiles));
        }

        Map<UUID, Instant> limited = new LinkedHashMap<>();
        timeLimitedGrantRepository.findByStatus(TimeLimitedUserGrant.STATUS_ACTIVE)
                .forEach(g -> limited.merge(g.getUser().getId(), g.getEndAt(), (a, b) -> a.isAfter(b) ? a : b));

        List<Holder> holders = users.values().stream()
                .filter(u -> !activeOnly || u.getStatus() == UserStatus.Active)
                .map(u -> new Holder(u.getId(), u.getEmployeeCode(), u.getUsername(), u.getFullName(), u.getDepartment(),
                        u.getStatus() == null ? null : u.getStatus().name(),
                        List.copyOf(profilesOf.getOrDefault(u.getId(), Set.of())), List.copyOf(setsOf.getOrDefault(u.getId(), Set.of())),
                        u.getLastLoginAt(), limited.get(u.getId())))
                .sorted(Comparator.comparing((Holder h) -> h.fullName() == null ? "" : h.fullName(), String.CASE_INSENSITIVE_ORDER))
                .toList();
        int active = (int) users.values().stream().filter(u -> u.getStatus() == UserStatus.Active).count();
        return new HoldersResponse(option(permission), sets, holders, users.size(), active);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static PermissionOption option(Permission p) {
        return new PermissionOption(p.getCode(), p.getName(), p.getModuleKey(), p.getCategory(), p.getDescription());
    }
}
