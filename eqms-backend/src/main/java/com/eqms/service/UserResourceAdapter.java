package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.authorization.ResolvedPolicy;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 4 (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md) -- User is the only Phase 4 resource
 * that got a real adapter (per user's Option 2 decision): it has a genuine lifecycle state
 * (Active/Suspended/Terminated/...) and actor relations (SELF), unlike the six pure permission-
 * catalog admin resources (Access Profile, Permission Set, Object Rules, Workflow Policy, SoD,
 * Access Review) which stay on the flat permission model.
 *
 * Shadow-eval only -- "USER" is deliberately NOT added to
 * {@code APP_AUTHORIZATION_HYBRID_ENGINE_ENABLED_RESOURCE_TYPES}. This adapter's job right now is
 * to agree with the legacy path (which already enforces {@link UserManagementService#
 * isSelfTargetingBlocked}/{@link UserManagementService#checkLastActiveAdminGuard} for real, not
 * via the engine) so a future cutover has zero-mismatch evidence to point to.
 */
@Component
public class UserResourceAdapter implements ResourceAuthorizationAdapter {

    private final UserAccountRepository userRepository;
    private final UserManagementService userManagementService;

    public UserResourceAdapter(UserAccountRepository userRepository, UserManagementService userManagementService) {
        this.userRepository = userRepository;
        this.userManagementService = userManagementService;
    }

    @Override
    public String resourceType() {
        return "USER";
    }

    @Override
    public String resolveState(UUID resourceId) {
        return findUser(resourceId).map(u -> u.getStatus() == null ? null : u.getStatus().name()).orElse(null);
    }

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        return null;
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        String permission = switch (actionCode) {
            case "SUSPEND", "TERMINATE", "REINSTATE", "UNLOCK", "UPDATE" -> "settings.user.edit";
            case "RESET_PASSWORD" -> "settings.user.reset_password";
            case "FORCE_LOGOUT" -> "settings.user.force_logout";
            case "DELETE" -> "settings.user.delete";
            case "VIEW" -> "settings.user.view";
            default -> null;
        };
        if (permission == null) {
            return Optional.empty();
        }
        return Optional.of(new ResolvedPolicy(permission, null, List.of(), "ANY"));
    }

    @Override
    public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) {
        if (actor == null || actor.getId() == null || resourceId == null) {
            return Set.of();
        }
        return actor.getId().equals(resourceId) ? Set.of("SELF") : Set.of();
    }

    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        if (actor == null || actor.getId() == null) {
            return false;
        }
        return !userManagementService.isSelfTargetingBlocked(actor.getId(), resourceId, action);
    }

    @Override
    public Optional<String> checkPrecondition(UUID resourceId, String actionCode) {
        return userManagementService.checkLastActiveAdminGuard(resourceId, actionCode);
    }

    private Optional<UserAccount> findUser(UUID resourceId) {
        return resourceId == null ? Optional.empty() : userRepository.findById(resourceId);
    }
}
