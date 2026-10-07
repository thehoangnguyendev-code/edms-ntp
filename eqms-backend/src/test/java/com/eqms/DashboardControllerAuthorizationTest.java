package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.DashboardController;
import com.eqms.entity.UserAccount;
import com.eqms.service.DashboardService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemMonitoringService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The server, not the screen, decides who may call the dashboard endpoints. */
@ExtendWith(MockitoExtension.class)
class DashboardControllerAuthorizationTest {

    @Mock DashboardService dashboardService;
    @Mock SystemMonitoringService systemMonitoringService;
    @Mock CurrentUserService currentUserService;
    @Mock PermissionEvaluationService permissions;
    @Mock UserAccount user;

    private DashboardController controller;

    @BeforeEach
    void setUp() {
        controller = new DashboardController(dashboardService, currentUserService, permissions, systemMonitoringService);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
    }

    @Test
    void systemMonitoringIsRefusedWithoutTheAdministrativeDashboardPermission() {
        // Holding the ordinary dashboard permission is not enough.
        lenient().when(permissions.hasPermission(user, "dashboard.module.view")).thenReturn(true);
        when(permissions.hasPermission(user, "dashboard.admin.view")).thenReturn(false);

        assertThatThrownBy(() -> controller.getSystemMonitoring()).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(systemMonitoringService);
    }

    @Test
    void systemMonitoringIsServedToAHolderOfTheAdministrativeDashboardPermission() {
        when(permissions.hasPermission(user, "dashboard.admin.view")).thenReturn(true);

        controller.getSystemMonitoring();

        verify(systemMonitoringService).getSystemMonitoring();
    }

    @Test
    void effectiveDocumentsByTypeNeedsTheOrdinaryDashboardPermission() {
        when(permissions.hasPermission(user, "dashboard.module.view")).thenReturn(false);

        assertThatThrownBy(() -> controller.getEffectiveDocumentsByType()).isInstanceOf(AccessDeniedException.class);
        verify(dashboardService, never()).getEffectiveDocumentsByType();
    }

    @Test
    void effectiveDocumentsByTypeIsServedToAHolderOfTheOrdinaryDashboardPermission() {
        when(permissions.hasPermission(user, "dashboard.module.view")).thenReturn(true);
        when(dashboardService.getEffectiveDocumentsByType()).thenReturn(List.of());

        assertThat(controller.getEffectiveDocumentsByType().getBody()).isEmpty();
    }
}
