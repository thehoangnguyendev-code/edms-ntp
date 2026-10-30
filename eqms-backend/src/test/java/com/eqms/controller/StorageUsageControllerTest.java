package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.StorageUsageSnapshotService;
import com.eqms.service.StorageUsagePolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import java.time.Instant;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StorageUsageControllerTest {
    @Test void deniesWithoutConfigurationManagementPermission() {
        var current = mock(CurrentUserService.class);
        var permissions = mock(PermissionEvaluationService.class);
        var service = mock(StorageUsageSnapshotService.class);
        var user = mock(UserAccount.class);
        when(current.requireCurrentUser()).thenReturn(user);
        var controller = new StorageUsageController(service, current, permissions, mock(StorageUsagePolicyService.class));
        assertThrows(AccessDeniedException.class, controller::history);
        verifyNoInteractions(service);
    }

    @Test void permitsConfigurationManagers() {
        var current = mock(CurrentUserService.class);
        var permissions = mock(PermissionEvaluationService.class);
        var service = mock(StorageUsageSnapshotService.class);
        var user = mock(UserAccount.class);
        when(current.requireCurrentUser()).thenReturn(user);
        when(permissions.hasPermission(user, "settings.configuration.manage")).thenReturn(true);
        when(service.history()).thenReturn(List.of());
        assertEquals(List.of(), new StorageUsageController(service, current, permissions, mock(StorageUsagePolicyService.class)).history());
    }

    @Test void warningUsesConfiguredBudgetAndOverflowSafeArithmetic() {
        var current = mock(CurrentUserService.class);
        var permissions = mock(PermissionEvaluationService.class);
        var service = mock(StorageUsageSnapshotService.class);
        var policies = mock(StorageUsagePolicyService.class);
        var user = mock(UserAccount.class);
        when(current.requireCurrentUser()).thenReturn(user);
        when(permissions.hasPermission(user, "settings.configuration.manage")).thenReturn(true);
        when(policies.get()).thenReturn(new StorageUsagePolicyService.Policy(Long.MAX_VALUE, 80));
        var empty = new ObjectMapper().createObjectNode();
        when(service.history()).thenReturn(List.of(new StorageUsageSnapshotService.Snapshot(Instant.now(), Long.MAX_VALUE, 1, empty, empty)));
        assertEquals(Boolean.TRUE, new StorageUsageController(service, current, permissions, policies).status().warning());
        when(service.history()).thenReturn(List.of());
        assertNull(new StorageUsageController(service, current, permissions, policies).status().warning());
    }
}
