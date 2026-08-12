package com.eqms.service;

import com.eqms.dto.security.AuthorizationContext;
import com.eqms.dto.security.AuthorizationDecision;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.exception.AuthorizationDeniedException;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Central authorization facade for permission-level checks that have no business-object context.
 *
 * Domain services remain authoritative when a decision depends on workflow state,
 * object attributes, participant assignment, segregation of duties, or an electronic
 * signature. Those checks cannot safely be evaluated from this generic facade alone.
 */
@Service
public class AuthorizationService {

    private final EffectivePermissionService effectivePermissionService;
    private final PermissionEvaluationService permissionEvaluationService;

    public AuthorizationService(
            EffectivePermissionService effectivePermissionService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.effectivePermissionService = effectivePermissionService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    /**
     * Evaluates an authorization decision without throwing.
     */
    public AuthorizationDecision check(
            UserAccount user,
            String permissionCode,
            String objectType,
            UUID objectId,
            AuthorizationContext context
    ) {
        if (user == null) {
            return AuthorizationDecision.denied("AUTH_REQUIRED", "Authentication is required.",
                    permissionCode, objectType, objectId);
        }

        // Q7: only an Active account is authorized — Pending/Suspended/Inactive/Terminated
        // are all denied here, not just Inactive. AuthTokenFilter already blocks these at the
        // SecurityContext level; this is defense-in-depth for any caller that resolves the
        // UserAccount independently of that filter.
        if (user.getStatus() != UserStatus.Active) {
            return AuthorizationDecision.denied("USER_NOT_ACTIVE", "User account is not active.",
                    permissionCode, objectType, objectId);
        }

        EffectivePermissionResult result = effectivePermissionService.getEffectivePermissionResult(user);

        if (!StringUtils.hasText(permissionCode)) {
            // No permission required — authenticated user is sufficient
            return AuthorizationDecision.allowed(permissionCode, result.systemSuperAdmin(), result.legacyFallbackUsed(), result.permissionCodes());
        }

        boolean granted = permissionEvaluationService.hasPermission(user, permissionCode);

        if (!granted) {
            return AuthorizationDecision.denied("MISSING_PERMISSION",
                    "You do not have permission to perform this action.",
                    permissionCode, objectType, objectId);
        }

        return AuthorizationDecision.allowed(permissionCode, result.systemSuperAdmin(), result.legacyFallbackUsed(), result.permissionCodes());
    }

    /**
     * Convenience overload without object context.
     */
    public AuthorizationDecision check(UserAccount user, String permissionCode) {
        return check(user, permissionCode, null, null, AuthorizationContext.simple(permissionCode));
    }

    /**
     * Throws {@link AuthorizationDeniedException} if the decision is denied.
     */
    public void require(
            UserAccount user,
            String permissionCode,
            String objectType,
            UUID objectId,
            AuthorizationContext context
    ) {
        AuthorizationDecision decision = check(user, permissionCode, objectType, objectId, context);
        if (!decision.allowed()) {
            throw new AuthorizationDeniedException(
                    permissionCode, objectType, objectId,
                    decision.reasonCode(), decision.message()
            );
        }
    }

    /**
     * Convenience overload without object context.
     */
    public void require(UserAccount user, String permissionCode) {
        require(user, permissionCode, null, null, AuthorizationContext.simple(permissionCode));
    }
}
