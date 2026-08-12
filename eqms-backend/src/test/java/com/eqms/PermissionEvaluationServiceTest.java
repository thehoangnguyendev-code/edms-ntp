package com.eqms;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Q7 — {@link PermissionEvaluationService#getPermissionCodes} is the code path most
 * controllers/services use for permission checks, so it must independently deny a
 * non-Active user rather than relying solely on {@code AuthTokenFilter} having blocked them
 * at the SecurityContext level.
 */
@ExtendWith(MockitoExtension.class)
class PermissionEvaluationServiceTest {

    @Mock private EffectivePermissionService effectivePermissionService;

    @InjectMocks
    private PermissionEvaluationService permissionEvaluationService;

    private UserAccount user;

    @BeforeEach
    void setUp() {
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
    }

    @Test
    void getPermissionCodes_activeUser_delegatesToEffectivePermissionService() {
        when(effectivePermissionService.getEffectivePermissionCodes(user)).thenReturn(Set.of("documents.module.view"));

        Set<String> codes = permissionEvaluationService.getPermissionCodes(user);

        assertEquals(Set.of("documents.module.view"), codes);
    }

    @Test
    void getPermissionCodes_suspendedUser_returnsEmptyWithoutCallingEffectivePermissionService() {
        user.setStatus(UserStatus.Suspended);

        Set<String> codes = permissionEvaluationService.getPermissionCodes(user);

        assertTrue(codes.isEmpty());
        verifyNoInteractions(effectivePermissionService);
    }

    @Test
    void getPermissionCodes_pendingUser_returnsEmpty() {
        user.setStatus(UserStatus.Pending);
        assertTrue(permissionEvaluationService.getPermissionCodes(user).isEmpty());
    }

    @Test
    void getPermissionCodes_inactiveUser_returnsEmpty() {
        user.setStatus(UserStatus.Inactive);
        assertTrue(permissionEvaluationService.getPermissionCodes(user).isEmpty());
    }

    @Test
    void getPermissionCodes_terminatedUser_returnsEmpty() {
        user.setStatus(UserStatus.Terminated);
        assertTrue(permissionEvaluationService.getPermissionCodes(user).isEmpty());
    }

    @Test
    void getPermissionCodes_suspendedThenReactivated_doesNotReturnStaleCachedEmptySet() {
        // The Active-only check runs BEFORE the cache write, so a Suspended lookup must never
        // poison the cache entry that the same user's Active lookup relies on.
        user.setStatus(UserStatus.Suspended);
        assertTrue(permissionEvaluationService.getPermissionCodes(user).isEmpty());

        user.setStatus(UserStatus.Active);
        when(effectivePermissionService.getEffectivePermissionCodes(user)).thenReturn(Set.of("documents.module.view"));

        assertEquals(Set.of("documents.module.view"), permissionEvaluationService.getPermissionCodes(user));
    }

    @Test
    void hasPermission_suspendedUser_isFalseEvenIfPermissionWouldOtherwiseBeGranted() {
        user.setStatus(UserStatus.Suspended);

        assertFalse(permissionEvaluationService.hasPermission(user, "documents.module.view"));
        verifyNoInteractions(effectivePermissionService);
    }
}
