package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.ResetMfaRequest;
import com.eqms.entity.UserAccount;
import com.eqms.service.EmailService;
import com.eqms.service.FileStorageService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.TimeLimitedUserGrantService;
import com.eqms.service.UserManagementService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.PostMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Reset MFA (SECURITY-AUTHORIZATION-REVIEW D4). The service is tested on its own; this checks the part a mock of the service cannot: that the address exists (the first DEV
 * run found the endpoint missing: the screen got "Resource not found" although every service test passed) and that the permission is asked before the service is reached.
 */
class SettingsUserControllerResetMfaTest {
    private final UserManagementService service = mock(UserManagementService.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final SettingsUserController controller = new SettingsUserController(service, mock(TimeLimitedUserGrantService.class), mock(SystemConfigurationService.class), current, permissions,
            mock(FileStorageService.class), mock(EmailService.class));
    private final UserAccount admin = new UserAccount();
    private final UUID target = UUID.randomUUID();
    private final ResetMfaRequest request = new ResetMfaRequest("Phone lost", "sig");

    @Test
    void theAddressExistsAsAPostOnUsersIdResetMfa() throws Exception {
        Method method = Arrays.stream(SettingsUserController.class.getDeclaredMethods()).filter(m -> m.getName().equals("resetMfa")).findFirst().orElseThrow();
        PostMapping mapping = method.getAnnotation(PostMapping.class);

        assertArrayEquals(new String[] {"/users/{id}/reset-mfa"}, mapping.value());
        assertTrue(SettingsUserController.class.getAnnotation(org.springframework.web.bind.annotation.RequestMapping.class).value()[0].equals("/settings"));
    }

    @Test
    void withTheResetMfaPermissionTheServiceIsCalledAndTheAnswerIsNoContent() {
        when(current.requireCurrentUser()).thenReturn(admin);
        when(permissions.hasPermission(admin, "settings.user.reset_mfa")).thenReturn(true);

        assertEquals(204, controller.resetMfa(target, request, null).getStatusCode().value());

        verify(service).resetMfa(target, request, null);
    }

    @Test
    void withoutThePermissionTheServiceIsNeverReached() {
        when(current.requireCurrentUser()).thenReturn(admin);
        // holding Reset Password is not enough: Reset MFA has its own permission
        when(permissions.hasPermission(admin, "settings.user.reset_password")).thenReturn(true);
        when(permissions.hasPermission(admin, "settings.user.reset_mfa")).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> controller.resetMfa(target, request, null));

        verifyNoInteractions(service);
    }
}
