package com.eqms.service;

import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.UserAccessProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Resolves the effective permission codes through active Access Profiles and their
 * Permission Sets. The historical {@code app_users.role_name} column is not an
 * entitlement source.
 */
@Service
public class EffectivePermissionService {

    /** The canonical code that marks a role as system super admin. */
    public static final String SYSTEM_SUPER_ADMIN_CODE = "SYSTEM_SUPER_ADMIN";

    private final UserAccessProfileRepository userAccessProfileRepository;
    private final AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;
    public EffectivePermissionService(
            UserAccessProfileRepository userAccessProfileRepository,
            AccessProfilePermissionSetRepository accessProfilePermissionSetRepository
    ) {
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.accessProfilePermissionSetRepository = accessProfilePermissionSetRepository;
    }

    @Transactional(readOnly = true)
    public Set<String> getEffectivePermissionCodes(UserAccount user) {
        return getEffectivePermissionResult(user).permissionCodes();
    }

    /**
     * Resolves permissions granted by one Access Profile only. Administrative checks such as
     * SoD scans must use this source instead of the retired role_permissions mapping.
     */
    @Transactional(readOnly = true)
    public Set<String> getEffectivePermissionCodes(RoleDefinition accessProfile) {
        if (accessProfile == null || accessProfile.getId() == null || !accessProfile.isActive()) {
            return Set.of();
        }
        Set<String> codes = new LinkedHashSet<>();
        for (AccessProfilePermissionSet link :
                accessProfilePermissionSetRepository.findByAccessProfileId(accessProfile.getId())) {
            PermissionSet permissionSet = link.getPermissionSet();
            if (permissionSet == null || !permissionSet.isActive()) {
                continue;
            }
            permissionSet.getItems().stream()
                    .map(item -> item.getPermission())
                    .filter(Objects::nonNull)
                    .map(permission -> normalize(permission.getCode()))
                    .filter(StringUtils::hasText)
                    .forEach(codes::add);
        }
        return Set.copyOf(codes);
    }

    @Transactional(readOnly = true)
    public EffectivePermissionResult getEffectivePermissionResult(UserAccount user) {
        if (user == null) {
            return emptyResult(null);
        }

        // Step 1 — flag system super admin via Access Profile model. This no longer grants a
        // wildcard permission set: per GMP Segregation of Duties, SYSTEM_SUPER_ADMIN only gets
        // whatever permissions its Access Profile is explicitly linked to (see
        // V243__seed_system_super_admin_permission_set.sql), same resolution path as any other
        // user. The flag itself is retained for non-permission concerns (maintenance-mode
        // exemption, admin UI badges).
        boolean systemSuperAdmin = isSystemSuperAdminViaAccessProfile(user.getId());
        // Resolve via Access Profile → PermissionSet → Permission.
        List<UserAccessProfile> profiles = userAccessProfileRepository.findByUserId(user.getId());
        List<String> activeProfileCodes = new ArrayList<>();
        List<String> activeSetCodes = new ArrayList<>();
        Set<String> codes = new LinkedHashSet<>();

        for (UserAccessProfile uap : profiles) {
            RoleDefinition profile = uap.getAccessProfile();
            if (profile == null || !profile.isActive()) {
                continue;
            }
            activeProfileCodes.add(profile.getCode());
            List<AccessProfilePermissionSet> setLinks =
                    accessProfilePermissionSetRepository.findByAccessProfileId(profile.getId());
            for (AccessProfilePermissionSet link : setLinks) {
                PermissionSet ps = link.getPermissionSet();
                if (ps == null || !ps.isActive()) {
                    continue;
                }
                activeSetCodes.add(ps.getCode());
                ps.getItems().stream()
                        .map(item -> item.getPermission())
                        .filter(Objects::nonNull)
                        .map(p -> normalize(p.getCode()))
                        .filter(StringUtils::hasText)
                        .forEach(codes::add);
            }
        }

        if (!activeProfileCodes.isEmpty()) {
            return new EffectivePermissionResult(user.getId(), codes, activeProfileCodes, activeSetCodes, systemSuperAdmin, false);
        }

        return new EffectivePermissionResult(user.getId(), Set.of(), List.of(), List.of(), systemSuperAdmin, false);
    }

    /** Evict caches when role/profile permissions change. Currently no internal cache — placeholder for Sprint 2. */
    // --- private helpers ---

    private boolean isSystemSuperAdminViaAccessProfile(UUID userId) {
        return userAccessProfileRepository.findByUserId(userId).stream()
                .map(UserAccessProfile::getAccessProfile)
                .filter(Objects::nonNull)
                .filter(RoleDefinition::isActive)
                .anyMatch(profile -> SYSTEM_SUPER_ADMIN_CODE.equalsIgnoreCase(profile.getCode()));
    }

    private EffectivePermissionResult emptyResult(UUID userId) {
        return new EffectivePermissionResult(userId, Set.of(), List.of(), List.of(), false, false);
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    public record EffectivePermissionResult(
            UUID userId,
            Set<String> permissionCodes,
            List<String> accessProfileCodes,
            List<String> permissionSetCodes,
            boolean systemSuperAdmin,
            boolean legacyFallbackUsed
    ) {}
}
