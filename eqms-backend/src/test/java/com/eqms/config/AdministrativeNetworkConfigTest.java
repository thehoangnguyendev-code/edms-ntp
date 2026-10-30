package com.eqms.config;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.AdministrativeNetworkPolicyController;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AdministrativeNetworkPolicyService;
import com.eqms.service.AuditTrailService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** The request filter of the administrative network policy: who is let in, who is refused, and how the server-side recovery switch works. */
class AdministrativeNetworkConfigTest {
    private final AdministrativeNetworkPolicyService policies = mock(AdministrativeNetworkPolicyService.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final UUID emergencyId = UUID.randomUUID();

    private HandlerInterceptor interceptor(boolean recoveryDisable) {
        var registry = new InterceptorRegistry() {
            Object first() { return getInterceptors().get(0); }
        };
        new AdministrativeNetworkConfig(policies, current, audit, recoveryDisable).addInterceptors(registry);
        return (HandlerInterceptor) registry.first();
    }

    private HandlerMethod adminHandler() throws Exception {
        var controller = mock(AdministrativeNetworkPolicyController.class);
        return new HandlerMethod(controller, AdministrativeNetworkPolicyController.class.getMethod("get"));
    }

    private UserAccount user(UUID id, UserStatus status) {
        var user = new UserAccount();
        user.setId(id);
        user.setStatus(status);
        return user;
    }

    private boolean call(HandlerInterceptor interceptor, String remote) throws Exception {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr(remote);
        return interceptor.preHandle(request, new MockHttpServletResponse(), adminHandler());
    }

    private void policy(boolean enabled) {
        when(policies.get()).thenReturn(new AdministrativeNetworkPolicyService.Settings(enabled, List.of("10.0.0.0/8"), List.of(), emergencyId));
    }

    @Test
    void anAdministratorInsideTheAllowedNetworkIsLetIn() throws Exception {
        policy(true);
        when(current.requireCurrentUser()).thenReturn(user(UUID.randomUUID(), UserStatus.Active));

        assertTrue(call(interceptor(false), "10.1.2.3"));
        verifyNoInteractions(audit);
    }

    @Test
    void anAdministratorOutsideTheAllowedNetworkIsRefusedAndTheRefusalIsAudited() throws Exception {
        policy(true);
        when(current.requireCurrentUser()).thenReturn(user(UUID.randomUUID(), UserStatus.Active));

        assertThrows(AccessDeniedException.class, () -> call(interceptor(false), "203.0.113.9"));
        verify(audit).logAs(any(), eq("ADMINISTRATIVE_NETWORK_POLICY"), any(), any(), eq("ADMIN_NETWORK_DENIED"), any(), any(), any());
    }

    @Test
    void theEmergencyAccountGetsInFromAnywhereAndTheUseIsAudited() throws Exception {
        policy(true);
        UserAccount signedIn = user(emergencyId, UserStatus.Active);
        when(current.requireCurrentUser()).thenReturn(signedIn);

        assertTrue(call(interceptor(false), "203.0.113.9"));
        verify(audit).logAs(any(), eq("ADMINISTRATIVE_NETWORK_POLICY"), any(), any(), eq("ADMIN_NETWORK_EMERGENCY_BYPASS"), any(), any(), any());
    }

    @Test
    void nothingIsCheckedWhenThePolicyIsOff() throws Exception {
        policy(false);

        assertTrue(call(interceptor(false), "203.0.113.9"));
        verifyNoInteractions(current, audit);
    }

    @Test
    void theServerSideRecoverySwitchLetsEveryoneInWithoutReadingThePolicy() throws Exception {
        assertTrue(call(interceptor(true), "203.0.113.9"));
        verifyNoInteractions(policies, current, audit);
    }

    @Test
    void aRequestToAnOrdinaryHandlerIsNeverFiltered() throws Exception {
        var registryInterceptor = interceptor(false);
        var handler = new HandlerMethod(this, AdministrativeNetworkConfigTest.class.getDeclaredMethod("ordinary"));

        assertTrue(registryInterceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handler));
        verifyNoInteractions(policies);
    }

    void ordinary() {}
}
