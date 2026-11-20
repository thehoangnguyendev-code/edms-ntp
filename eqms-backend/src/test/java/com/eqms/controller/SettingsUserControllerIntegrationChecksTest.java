package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.EmailService;
import com.eqms.service.FileStorageService;
import com.eqms.service.IntegrationCheckService;
import com.eqms.service.OnlyOfficeConfigurationService;
import com.eqms.service.OnlyOfficeConnectionCheckService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.TimeLimitedUserGrantService;
import com.eqms.service.UserManagementService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * The "Test connection" of Storage and OnlyOffice and the "last check" the Integrations page shows (Configuration > Integrations). Checks what the services cannot: that the
 * addresses exist, that the right permission is asked before anything runs, and that each test leaves its result behind without changing its own answer.
 */
class SettingsUserControllerIntegrationChecksTest {
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final FileStorageService storage = mock(FileStorageService.class);
    private final OnlyOfficeConnectionCheckService onlyOfficeChecks = mock(OnlyOfficeConnectionCheckService.class);
    private final OnlyOfficeConfigurationService onlyOfficeConfiguration = mock(OnlyOfficeConfigurationService.class);
    private final IntegrationCheckService checks = mock(IntegrationCheckService.class);
    private final SettingsUserController controller = new SettingsUserController(mock(UserManagementService.class), mock(TimeLimitedUserGrantService.class), mock(SystemConfigurationService.class),
            current, permissions, storage, mock(EmailService.class));
    private final UserAccount admin = new UserAccount();
    private final ObjectMapper mapper = new ObjectMapper();

    SettingsUserControllerIntegrationChecksTest() {
        ReflectionTestUtils.setField(controller, "onlyOfficeConnectionCheckService", onlyOfficeChecks);
        ReflectionTestUtils.setField(controller, "onlyOfficeConfigurationService", onlyOfficeConfiguration);
        ReflectionTestUtils.setField(controller, "integrationCheckService", checks);
        when(current.requireCurrentUser()).thenReturn(admin);
        when(onlyOfficeConfiguration.getEffectiveConfiguration()).thenReturn(new OnlyOfficeConfigurationService.OnlyOfficeConfiguration(true, "http://onlyoffice", "http://backend:5000", "s"));
    }

    private void grant(String permission) {
        when(permissions.hasPermission(admin, permission)).thenReturn(true);
    }

    @Test
    void theAddressesExist() {
        var get = Arrays.stream(SettingsUserController.class.getDeclaredMethods()).filter(m -> m.getName().equals("getIntegrationChecks")).findFirst().orElseThrow();
        assertArrayEquals(new String[] {"/system/integrations/checks"}, get.getAnnotation(GetMapping.class).value());
        var oo = Arrays.stream(SettingsUserController.class.getDeclaredMethods()).filter(m -> m.getName().equals("testOnlyOfficeConnection")).findFirst().orElseThrow();
        assertArrayEquals(new String[] {"/system/onlyoffice/test-connection"}, oo.getAnnotation(PostMapping.class).value());
    }

    @Test
    void theLastChecksCanBeReadWithTheViewPermissionAlone() {
        grant("settings.config_integrations.view");
        var check = new IntegrationCheckService.Check("STORAGE", true, "ok", "MinIO · x", List.of(), java.time.Instant.EPOCH, "Admin");
        when(checks.latest()).thenReturn(Map.of("STORAGE", check));

        assertEquals(Map.of("STORAGE", check), controller.getIntegrationChecks().getBody());
    }

    @Test
    void withoutAnyIntegrationsPermissionNothingIsReadOrRun() {
        assertThrows(AccessDeniedException.class, () -> controller.getIntegrationChecks());
        assertThrows(AccessDeniedException.class, () -> controller.testOnlyOfficeConnection());
        assertThrows(AccessDeniedException.class, () -> controller.testStorageConnection(mapper.createObjectNode()));
        // holding the View permission is not enough to run a test
        grant("settings.config_integrations.view");
        assertThrows(AccessDeniedException.class, () -> controller.testOnlyOfficeConnection());
        assertThrows(AccessDeniedException.class, () -> controller.testStorageConnection(mapper.createObjectNode()));

        verifyNoInteractions(onlyOfficeChecks, storage, checks);
    }

    @Test
    void theOnlyOfficeTestKeepsItsAnswerAddsTheStepsAndLeavesTheResultBehind() {
        grant("settings.config_integrations.manage");
        var steps = List.of(new IntegrationCheckService.Step("reachable", "Document Server reachable", "OK", "fine"));
        when(onlyOfficeChecks.run()).thenReturn(new OnlyOfficeConnectionCheckService.Result(true, "reachable and healthy", steps));

        var body = controller.testOnlyOfficeConnection().getBody();

        assertEquals(true, body.get("success"));
        assertEquals("reachable and healthy", body.get("message"));
        assertEquals(steps, body.get("steps"));
        verify(checks).record(admin, "ONLYOFFICE", true, "reachable and healthy", "OnlyOffice · http://onlyoffice", steps);
    }

    @Test
    void theStorageTestLeavesTheResultBehindForASuccessAndForBothKindsOfFailure() throws Exception {
        grant("settings.config_integrations.manage");
        var request = mapper.readTree("{\"provider\":\"minio\",\"minioEndpoint\":\"http://minio:9000\",\"minioBucket\":\"b\",\"minioSecretAccessKey\":\"TOP-SECRET\"}");

        assertEquals(200, controller.testStorageConnection(request).getStatusCode().value());
        verify(checks).record(admin, "STORAGE", true, "Storage connection test successful.", "MinIO · http://minio:9000 · b", List.of());

        doThrow(new IllegalArgumentException("Endpoint is required")).when(storage).testConnection(any());
        assertEquals(400, controller.testStorageConnection(request).getStatusCode().value());
        verify(checks).record(admin, "STORAGE", false, "Endpoint is required", "MinIO · http://minio:9000 · b", List.of());

        doThrow(new IllegalStateException("refused")).when(storage).testConnection(any());
        assertEquals(500, controller.testStorageConnection(request).getStatusCode().value());
        verify(checks).record(eq(admin), eq("STORAGE"), eq(false), eq("Storage connection test failed: refused"), eq("MinIO · http://minio:9000 · b"), eq(List.of()));
        // the secret of the request never reaches what is kept
        verify(checks, never()).record(any(), any(), anyBoolean(), any(), argThat(subject -> subject != null && subject.contains("TOP-SECRET")), any());
    }
}
