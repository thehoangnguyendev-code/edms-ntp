package com.eqms;

import com.eqms.dto.security.AuthorizationDecision;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.exception.AuthorizationDeniedException;
import com.eqms.service.AuthorizationService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.EffectivePermissionService.EffectivePermissionResult;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationServiceTest {

    @Mock private EffectivePermissionService effectivePermissionService;
    @Mock private PermissionEvaluationService permissionEvaluationService;

    @InjectMocks
    private AuthorizationService authorizationService;

    private UserAccount activeUser;

    @BeforeEach
    void setUp() {
        activeUser = new UserAccount();
        activeUser.setId(UUID.randomUUID());
        activeUser.setUsername("user1");
        activeUser.setStatus(UserStatus.Active);
    }

    // ── check() scenarios ─────────────────────────────────────────────────────

    @Test
    void check_null_user_returns_AUTH_REQUIRED_denied() {
        AuthorizationDecision decision = authorizationService.check(null, "audit.view");

        assertFalse(decision.allowed());
        assertEquals("AUTH_REQUIRED", decision.reasonCode());
    }

    @Test
    void check_inactive_user_returns_USER_NOT_ACTIVE_denied() {
        activeUser.setStatus(UserStatus.Inactive);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertFalse(decision.allowed());
        assertEquals("USER_NOT_ACTIVE", decision.reasonCode());
    }

    @Test
    void check_pending_user_returns_USER_NOT_ACTIVE_denied() {
        activeUser.setStatus(UserStatus.Pending);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertFalse(decision.allowed());
        assertEquals("USER_NOT_ACTIVE", decision.reasonCode());
    }

    @Test
    void check_suspended_user_returns_USER_NOT_ACTIVE_denied() {
        activeUser.setStatus(UserStatus.Suspended);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertFalse(decision.allowed());
        assertEquals("USER_NOT_ACTIVE", decision.reasonCode());
    }

    @Test
    void check_terminated_user_returns_USER_NOT_ACTIVE_denied() {
        activeUser.setStatus(UserStatus.Terminated);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertFalse(decision.allowed());
        assertEquals("USER_NOT_ACTIVE", decision.reasonCode());
    }

    @Test
    void check_system_super_admin_requires_explicit_permission() {
        EffectivePermissionResult superAdminResult = new EffectivePermissionResult(
                activeUser.getId(), Set.of(), List.of("SYSTEM_SUPER_ADMIN"), List.of(), true, false);
        when(effectivePermissionService.getEffectivePermissionResult(activeUser)).thenReturn(superAdminResult);
        when(permissionEvaluationService.hasPermission(activeUser, "any.permission.code")).thenReturn(false);

        AuthorizationDecision decision = authorizationService.check(activeUser, "any.permission.code");

        assertFalse(decision.allowed());
        assertEquals("MISSING_PERMISSION", decision.reasonCode());
    }

    @Test
    void check_system_super_admin_with_explicit_permission_is_allowed() {
        EffectivePermissionResult superAdminResult = new EffectivePermissionResult(
                activeUser.getId(), Set.of("audit.view"), List.of("SYSTEM_SUPER_ADMIN"), List.of(), true, false);
        when(effectivePermissionService.getEffectivePermissionResult(activeUser)).thenReturn(superAdminResult);
        when(permissionEvaluationService.hasPermission(activeUser, "audit.view")).thenReturn(true);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertTrue(decision.allowed());
        assertTrue(decision.systemSuperAdmin());
    }

    @Test
    void check_granted_permission_returns_allowed() {
        EffectivePermissionResult result = new EffectivePermissionResult(
                activeUser.getId(), Set.of("audit.view"), List.of("QA_ROLE"), List.of(), false, false);
        when(effectivePermissionService.getEffectivePermissionResult(activeUser)).thenReturn(result);
        when(permissionEvaluationService.hasPermission(activeUser, "audit.view")).thenReturn(true);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertTrue(decision.allowed());
        assertFalse(decision.systemSuperAdmin());
    }

    @Test
    void check_missing_permission_returns_MISSING_PERMISSION_denied() {
        EffectivePermissionResult result = new EffectivePermissionResult(
                activeUser.getId(), Set.of("documents.module.view"), List.of("VIEWER"), List.of(), false, false);
        when(effectivePermissionService.getEffectivePermissionResult(activeUser)).thenReturn(result);
        when(permissionEvaluationService.hasPermission(activeUser, "audit.view")).thenReturn(false);

        AuthorizationDecision decision = authorizationService.check(activeUser, "audit.view");

        assertFalse(decision.allowed());
        assertEquals("MISSING_PERMISSION", decision.reasonCode());
    }

    // ── require() scenarios ───────────────────────────────────────────────────

    @Test
    void require_throws_AuthorizationDeniedException_on_deny() {
        EffectivePermissionResult result = new EffectivePermissionResult(
                activeUser.getId(), Set.of(), List.of(), List.of(), false, false);
        when(effectivePermissionService.getEffectivePermissionResult(activeUser)).thenReturn(result);
        when(permissionEvaluationService.hasPermission(activeUser, "audit.export")).thenReturn(false);

        AuthorizationDeniedException ex = assertThrows(
                AuthorizationDeniedException.class,
                () -> authorizationService.require(activeUser, "audit.export")
        );
        assertEquals("audit.export", ex.getPermissionCode());
        assertEquals("MISSING_PERMISSION", ex.getReasonCode());
    }

    @Test
    void require_does_not_throw_when_permission_granted() {
        EffectivePermissionResult result = new EffectivePermissionResult(
                activeUser.getId(), Set.of("audit.export"), List.of(), List.of(), false, false);
        when(effectivePermissionService.getEffectivePermissionResult(activeUser)).thenReturn(result);
        when(permissionEvaluationService.hasPermission(activeUser, "audit.export")).thenReturn(true);

        assertDoesNotThrow(() -> authorizationService.require(activeUser, "audit.export"));
    }

    @Test
    void require_throws_with_null_user() {
        AuthorizationDeniedException ex = assertThrows(
                AuthorizationDeniedException.class,
                () -> authorizationService.require(null, "audit.view")
        );
        assertEquals("AUTH_REQUIRED", ex.getReasonCode());
    }
}
