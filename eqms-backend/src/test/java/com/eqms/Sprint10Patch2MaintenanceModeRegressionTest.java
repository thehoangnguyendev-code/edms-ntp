package com.eqms;

import com.eqms.auth.AuthTokenFilter;
import com.eqms.auth.AuthenticatedUser;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Sprint 10 Patch 2 — Regression tests for maintenance-mode bypass fix.
 *
 * Verifies that raw role-name strings ("SUPERADMIN", "ADMIN") no longer grant
 * maintenance-mode exemption. Only users with the explicit
 * {@code security.maintenance.bypass} permission are exempt -- the identity-based
 * {@code PermissionEvaluationService.isSuperAdmin()} fallback has since been retired
 * entirely (the SYSTEM_SUPER_ADMIN profile was merged into ADMINISTRATOR).
 */
@ExtendWith(MockitoExtension.class)
class Sprint10Patch2MaintenanceModeRegressionTest {

    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock SystemConfigurationService systemConfigurationService;
    @Mock AuthSessionRepository authSessionRepository;
    @Mock UserAccountRepository userAccountRepository;
    @Mock AuditTrailService auditTrailService;

    AuthTokenFilter filter;
    Method isMaintenanceBlocked;

    @BeforeEach
    void setUp() throws Exception {
        filter = new AuthTokenFilter(
                null, authSessionRepository, userAccountRepository,
                permissionEvaluationService, systemConfigurationService,
                auditTrailService, new ObjectMapper()
        );
        isMaintenanceBlocked = AuthTokenFilter.class.getDeclaredMethod(
                "isMaintenanceBlocked", String.class, AuthenticatedUser.class, UserAccount.class);
        isMaintenanceBlocked.setAccessible(true);

        when(systemConfigurationService.isMaintenanceModeEnabled()).thenReturn(true);
    }

    @Test
    void maintenanceMode_userWithBypassPermission_allowed() throws Exception {
        AuthenticatedUser principal = principal(Set.of("security.maintenance.bypass"));
        UserAccount user = user("bypass-user");
        // isSuperAdmin not called — bypass permission short-circuits

        boolean blocked = invoke(isMaintenanceBlocked, filter, "/api/documents", principal, user);
        assertThat(blocked).isFalse();
    }

    @Test
    void maintenanceMode_superAdminFlagWithoutBypassPermission_denied() throws Exception {
        // The old isSuperAdmin() fallback is gone -- even a user for whom isSuperAdmin() would
        // report true (hypothetically) is blocked without the actual bypass permission.
        AuthenticatedUser principal = principal(Set.of("some.other.permission"));
        UserAccount user = user("sys-super-admin");

        boolean blocked = invoke(isMaintenanceBlocked, filter, "/api/documents", principal, user);
        assertThat(blocked).isTrue();
    }

    @Test
    void maintenanceMode_roleNameOnlySuperAdmin_withoutPermission_denied() throws Exception {
        // Old bypass: role="SUPERADMIN" alone was never enough — must be blocked
        AuthenticatedUser principal = principal(Set.of());
        UserAccount user = user("role-name-superadmin");
        user.setRoleName("SUPERADMIN");

        boolean blocked = invoke(isMaintenanceBlocked, filter, "/api/documents", principal, user);
        assertThat(blocked).isTrue();
    }

    @Test
    void maintenanceMode_roleNameOnlyAdmin_withoutPermission_denied() throws Exception {
        // Old bypass: role="ADMIN" alone was never enough — must be blocked
        AuthenticatedUser principal = principal(Set.of());
        UserAccount user = user("role-name-admin");
        user.setRoleName("ADMIN");

        boolean blocked = invoke(isMaintenanceBlocked, filter, "/api/documents", principal, user);
        assertThat(blocked).isTrue();
    }

    @Test
    void maintenanceMode_normalUser_denied() throws Exception {
        AuthenticatedUser principal = principal(Set.of("documents.view"));
        UserAccount user = user("normal-user");

        boolean blocked = invoke(isMaintenanceBlocked, filter, "/api/documents", principal, user);
        assertThat(blocked).isTrue();
    }

    @Test
    void maintenanceMode_authEndpoint_neverBlocked() throws Exception {
        // /api/auth/** is always exempt regardless of user
        AuthenticatedUser principal = principal(Set.of());
        UserAccount user = user("any-user");

        boolean blocked = invoke(isMaintenanceBlocked, filter, "/api/auth/login", principal, user);
        assertThat(blocked).isFalse();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean invoke(Method m, Object target, Object... args) throws Exception {
        return (boolean) m.invoke(target, args);
    }

    private AuthenticatedUser principal(Set<String> permissions) {
        return new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "testuser", "SomeRole", permissions);
    }

    private UserAccount user(String name) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setUsername(name);
        u.setStatus(UserStatus.Active);
        return u;
    }
}
