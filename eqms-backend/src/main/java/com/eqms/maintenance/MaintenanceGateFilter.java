package com.eqms.maintenance;

import com.eqms.auth.TokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * The maintenance gate (SDS 11.5.3). It runs before the authentication filter, so while the system is DRAINED or LOCKED no
 * ordinary user, and no administrator, can do anything but the few calls the maintenance window needs. The state comes from a
 * lock file written by the Backup Agent, not from the eQMS database, so the gate holds while that database is replaced.
 * If the file exists but cannot be read, the gate stays closed: an unreadable lock is treated as a lock.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MaintenanceGateFilter extends OncePerRequestFilter {

    private static final ObjectMapper JSON = new ObjectMapper();
    /** The administrator exception (SDS 11.5.3): a person with this permission may work while the system is drained or locked. */
    public static final String BYPASS_PERMISSION = "security.maintenance.bypass";
    /**
     * Paths open while the system is locked. Everything else answers 503 MAINTENANCE_MODE. The login path is open so that a person
     * with the bypass can sign in; the login service refuses everyone else while the system is locked.
     */
    private static final List<String> OPEN_PREFIXES = List.of("/system/maintenance-status", "/system/maintenance/", "/health", "/actuator/", "/auth/login");

    private final Path lockFile;
    private final TokenService tokens;
    private final com.eqms.repository.UserAccountRepository users;
    private final com.eqms.service.PermissionEvaluationService permissions;

    public MaintenanceGateFilter(@Value("${app.maintenance.lock-file:/maintenance/maintenance.lock}") String lockFile, TokenService tokens,
                                 com.eqms.repository.UserAccountRepository users, com.eqms.service.PermissionEvaluationService permissions) {
        this.lockFile = Path.of(lockFile);
        this.tokens = tokens;
        this.users = users;
        this.permissions = permissions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (!isLocked() || isOpen(request) || hasBypass(request)) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setHeader("Retry-After", "60");
        response.setHeader("Cache-Control", "no-store");
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"MAINTENANCE_MODE\",\"message\":\"The system is in a maintenance window. Please try again later.\"}");
    }

    private boolean isOpen(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) return true;
        String path = request.getRequestURI().substring(request.getContextPath().length());
        for (String prefix : OPEN_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix)) return true;
        }
        return false;
    }

    /**
     * A request whose access token carries the bypass permission goes through. The check reads the token only, not the database,
     * so it does not depend on the database that may be replaced. A token that does not verify counts as no bypass.
     */
    private boolean hasBypass(HttpServletRequest request) {
        String token = accessToken(request);
        if (token == null) return false;
        try {
            // The token does not carry the permissions (they are read per request), so the holder is looked up in the database. If the
            // database cannot answer, the gate stays closed.
            return tokens.parseAccessToken(token)
                    .map(parsed -> userHasBypass(parsed.principal().userId()))
                    .orElse(false);
        } catch (RuntimeException e) {
            return false;
        }
    }

    private boolean userHasBypass(java.util.UUID userId) {
        return users.findById(userId).map(user -> permissions.hasPermission(user, BYPASS_PERMISSION)).orElse(false);
    }

    private static String accessToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) return cookie.getValue();
            }
        }
        String header = request.getHeader("Authorization");
        return header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
    }

    /**
     * True when the lock file says DRAINED or any LOCKED state (LOCKED_RESTORING today; later states of the restore window also start
     * with LOCKED). A missing file means open; an unreadable one means locked.
     */
    public boolean isLocked() {
        if (!Files.exists(lockFile)) return false;
        try {
            JsonNode body = JSON.readTree(Files.readString(lockFile, StandardCharsets.UTF_8));
            String state = body.path("state").asText("");
            return "DRAINED".equals(state) || state.startsWith("LOCKED");
        } catch (IOException | RuntimeException e) {
            return true;
        }
    }
}
