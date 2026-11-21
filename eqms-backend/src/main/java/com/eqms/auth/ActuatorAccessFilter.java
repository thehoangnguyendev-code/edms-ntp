package com.eqms.auth;

import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Server statistics (metrics, health detail) are for the people who may see System Information, not for
 * every signed-in person (API review 2026-11-21, owner decision). Runs after the token filter, inside
 * Spring Security's chain only. A request that is not signed in is left to the chain (401/403 as before).
 */
@Component
public class ActuatorAccessFilter extends OncePerRequestFilter {

    public static final String PERMISSION = "settings.system_info.view";

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public ActuatorAccessFilter(CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !(path.contains("/actuator/") || path.endsWith("/actuator"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            chain.doFilter(request, response);
            return;
        }
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, PERMISSION)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"error\":{\"code\":\"FORBIDDEN\",\"message\":\"Server statistics need the System Information view permission\",\"details\":[]}}");
            return;
        }
        chain.doFilter(request, response);
    }
}
