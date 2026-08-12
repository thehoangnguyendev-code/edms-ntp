package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Legacy permission-check facade kept for controllers/services not yet migrated to
 * {@link AuthorizationService}. Resolution is delegated entirely to
 * {@link EffectivePermissionService} (Access Profile → Permission Set → Permission);
 * {@code app_users.role_name} is not an entitlement source and is never consulted here.
 */
@Service
public class PermissionEvaluationService {

    private static final Map<String, List<String>> PERMISSION_ALIASES = Map.ofEntries(
            Map.entry("documents.module.view", List.of("VIEW_DOCUMENTS")),
            Map.entry("documents.document.create", List.of("CREATE_DOCUMENT_SHELL", "CREATE_DOCUMENTS")),
            Map.entry("documents.document.edit_metadata", List.of("EDIT_DOCUMENT_METADATA", "EDIT_DOCUMENTS")),
            Map.entry("documents.document.view_audit", List.of("VIEW_DOCUMENT_AUDIT_TRAIL", "VIEW_AUDIT_TRAIL")),
            Map.entry("documents.revision.review", List.of("COMPLETE_REVIEW", "REVIEW_DOCUMENTS")),
            Map.entry("documents.revision.approve", List.of("APPROVE_REVISION", "APPROVE_DOCUMENTS")),
            Map.entry("documents.revision.publish", List.of("PUBLISH_REVISION", "PUBLISH_DOCUMENTS")),
            Map.entry("documents.training.manage", List.of("MANAGE_TRAINING_PLAN")),
            Map.entry("documents.training.complete", List.of("COMPLETE_TRAINING")),
            Map.entry("settings.role.view", List.of("MANAGE_ROLES")),
            Map.entry("settings.role.manage", List.of("MANAGE_ROLES")),
            Map.entry("settings.role.assign_permissions", List.of("MANAGE_ROLES"))
    );

    private final EffectivePermissionService effectivePermissionService;
    private final ConcurrentHashMap<UUID, Set<String>> permissionCache = new ConcurrentHashMap<>();

    public PermissionEvaluationService(EffectivePermissionService effectivePermissionService) {
        this.effectivePermissionService = effectivePermissionService;
    }

    /** True only if the user holds an active Access Profile with code SYSTEM_SUPER_ADMIN. */
    public boolean isSuperAdmin(UserAccount user) {
        if (user == null || user.getId() == null) {
            return false;
        }
        return effectivePermissionService.getEffectivePermissionResult(user).systemSuperAdmin();
    }

    public Set<String> getPermissionCodes(UserAccount user) {
        if (user == null || user.getId() == null) {
            return Set.of();
        }
        // Q7: checked BEFORE the cache lookup — caching an empty set for a non-Active user here
        // would be indistinguishable from "no permissions granted yet" and would mask the real
        // grants the instant the account is reactivated, since evictUserPermissionCache() is the
        // only thing that would otherwise clear it.
        if (user.getStatus() != UserStatus.Active) {
            return Set.of();
        }
        return permissionCache.computeIfAbsent(user.getId(),
                id -> effectivePermissionService.getEffectivePermissionCodes(user));
    }

    public void evictUserPermissionCache(UUID userId) {
        if (userId != null) {
            permissionCache.remove(userId);
        }
    }

    public void clearCache() {
        permissionCache.clear();
    }

    /**
     * Per GMP Segregation of Duties (see V243__seed_system_super_admin_permission_set.sql),
     * SYSTEM_SUPER_ADMIN receives no implicit wildcard grant here — every permission,
     * including for that profile, must be resolved from actual Access Profile assignments.
     */
    public boolean hasPermission(UserAccount user, String code) {
        if (!StringUtils.hasText(code) || user == null) {
            return false;
        }
        Set<String> granted = getPermissionCodes(user);
        if (granted.isEmpty()) {
            return false;
        }

        String normalizedCode = normalize(code);
        if (granted.contains(normalizedCode)) {
            return true;
        }

        return PERMISSION_ALIASES.getOrDefault(normalizedCode, List.of()).stream()
                .map(this::normalize)
                .anyMatch(granted::contains);
    }

    public boolean hasAnyPermission(UserAccount user, String... codes) {
        return Arrays.stream(codes)
                .filter(StringUtils::hasText)
                .anyMatch(code -> hasPermission(user, code));
    }

    public boolean hasAllPermissions(UserAccount user, String... codes) {
        return Arrays.stream(codes)
                .filter(StringUtils::hasText)
                .allMatch(code -> hasPermission(user, code));
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }
}
