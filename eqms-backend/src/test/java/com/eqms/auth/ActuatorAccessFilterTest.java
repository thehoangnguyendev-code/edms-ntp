package com.eqms.auth;

import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Server statistics need the System Information view permission; other paths are untouched. */
class ActuatorAccessFilterTest {

    private final CurrentUserService users = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final ActuatorAccessFilter filter = new ActuatorAccessFilter(users, permissions);
    private final FilterChain chain = mock(FilterChain.class);
    private final UserAccount user = mock(UserAccount.class);

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void signedIn() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("someone", "n/a", List.of()));
        when(users.requireCurrentUser()).thenReturn(user);
    }

    @Test
    void signedInPersonWithoutThePermissionIsRefusedOnMetrics() throws Exception {
        signedIn();
        when(permissions.hasPermission(user, "settings.system_info.view")).thenReturn(false);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest("GET", "/api/actuator/metrics"), response, chain);

        assertEquals(403, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void personWithThePermissionPasses() throws Exception {
        signedIn();
        when(permissions.hasPermission(user, "settings.system_info.view")).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/actuator/metrics");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void otherPathsAreNotChecked() throws Exception {
        signedIn();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/documents");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(permissions, never()).hasPermission(any(), any());
    }

    @Test
    void notSignedInIsLeftToTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/actuator/metrics");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}
