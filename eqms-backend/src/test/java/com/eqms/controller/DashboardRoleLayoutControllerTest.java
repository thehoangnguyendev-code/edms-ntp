package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.DashboardRoleLayoutService;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DashboardRoleLayoutControllerTest {
    @Test void modifyingRoleDefaultsRequiresConfigurationPermission() {
        var service = mock(DashboardRoleLayoutService.class);
        var current = mock(CurrentUserService.class);
        var permissions = mock(PermissionEvaluationService.class);
        var user = mock(UserAccount.class);
        when(current.requireCurrentUser()).thenReturn(user);
        var controller = new DashboardRoleLayoutController(service, current, permissions, new ObjectMapper());
        assertThrows(AccessDeniedException.class, () -> controller.save(UUID.randomUUID(), new DashboardRoleLayoutController.Update(1, new ObjectMapper().createObjectNode())));
        verifyNoInteractions(service);
    }
}
