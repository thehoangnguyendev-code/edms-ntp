package com.eqms.auth;

import com.eqms.entity.AuthSession;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AuthSessionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.AuditTrailService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final AuthSessionRepository sessionRepository;
    private final UserAccountRepository userRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SystemConfigurationService systemConfigurationService;
    private final AuditTrailService auditTrailService;
    private final ObjectMapper objectMapper;

    public AuthTokenFilter(
            TokenService tokenService,
            AuthSessionRepository sessionRepository,
            UserAccountRepository userRepository,
            PermissionEvaluationService permissionEvaluationService,
            SystemConfigurationService systemConfigurationService,
            AuditTrailService auditTrailService,
            ObjectMapper objectMapper
    ) {
        this.tokenService = tokenService;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.systemConfigurationService = systemConfigurationService;
        this.auditTrailService = auditTrailService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = null;
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName())) {
                    token = cookie.getValue();
                    break;
                }
            }
        }
        if (token == null || token.isBlank()) {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                token = header.substring(7);
            }
        }
        if (token != null && !token.isBlank()) {
            boolean isReauthenticateRequest = request.getRequestURI() != null
                    && request.getRequestURI().contains("/api/auth/reauthenticate");
            // A user can stay idle-locked well past the access token's own TTL; the unlock flow's
            // password check — not token freshness — is what authorizes resuming the session, so an
            // expired-but-otherwise-valid token is still accepted here.
            var parsed = isReauthenticateRequest
                    ? tokenService.parseAccessTokenAllowExpired(token)
                    : tokenService.parseAccessToken(token);
            if (parsed.isPresent()) {
                var claims = parsed.get();
                if ("access".equals(claims.tokenType())) {
                    var sessionOptional = sessionRepository.findById(claims.principal().sessionId());
                    if (sessionOptional.isPresent()) {
                        AuthSession session = sessionOptional.get();
                        if (session.getRevokedAt() != null) {
                            filterChain.doFilter(request, response);
                            return;
                        }

                        if (session.getExpiresAt() != null && !session.getExpiresAt().isAfter(Instant.now())) {
                            session.setStatus(AuthSession.SessionStatus.EXPIRED);
                            sessionRepository.save(session);
                            filterChain.doFilter(request, response);
                            return;
                        }

                        if (session.getStatus() == AuthSession.SessionStatus.LOCKED && !isReauthenticateRequest) {
                            writeSessionLockedResponse(response);
                            return;
                        }

                        int timeoutMinutes = systemConfigurationService.getSessionTimeoutMinutes();
                        Instant now = Instant.now();
                        Instant lastActivityAt = session.getLastActivityAt() == null ? session.getCreatedAt() : session.getLastActivityAt();
                        long idleMinutes = lastActivityAt == null ? 0 : Duration.between(lastActivityAt, now).toMinutes();
                        // Idle detection must run even on the reauthenticate call itself: the client's
                        // idle timer shows the "session locked" modal purely off its own local clock, so
                        // the very first request to reach the server after crossing the timeout is often
                        // this reauthenticate request. If we only persisted LOCKED for non-reauthenticate
                        // requests, the session would still read ACTIVE here and
                        // AuthService.reauthenticate() would reject a correct password with
                        // "Session is not locked". Only the reject-and-return branch below is skipped
                        // for reauthenticate — persisting the LOCKED status still happens so the
                        // reauthenticate flow sees the session it expects.
                        if (lastActivityAt != null && session.getStatus() != AuthSession.SessionStatus.LOCKED) {
                            if (timeoutMinutes > 0 && idleMinutes >= timeoutMinutes) {
                                session.setStatus(AuthSession.SessionStatus.LOCKED);
                                session.setLockedAt(now);
                                session.setCurrentSession(false);
                                sessionRepository.save(session);
                                auditTrailService.logSafely(
                                        "SESSION",
                                        "Session",
                                        session.getId(),
                                        "SESSION_LOCKED_IDLE_TIMEOUT",
                                        null,
                                        null,
                                        "Session locked due to inactivity"
                                );
                                if (!isReauthenticateRequest) {
                                    writeSessionLockedResponse(response);
                                    return;
                                }
                            }
                        }

                        if (!session.isActive() && !isReauthenticateRequest) {
                            filterChain.doFilter(request, response);
                            return;
                        }

                        UserAccount user = userRepository.findById(claims.principal().userId()).orElse(null);

                        // Q7: only Active accounts may be granted a SecurityContext. Pending /
                        // Suspended / Inactive / Terminated are all denied here, before any
                        // permission or password check — account status is the highest-priority
                        // gate. isReauthenticateRequest is not exempted: an inactive account must
                        // not be able to unlock its own idle-locked session either.
                        if (user == null || user.getStatus() != UserStatus.Active) {
                            writeAccountNotActiveResponse(response, user == null ? null : user.getStatus());
                            auditTrailService.logSafely(
                                    "SESSION",
                                    user == null ? null : user.getFullName(),
                                    user == null ? null : user.getId(),
                                    "ACCESS_DENIED_INACTIVE_ACCOUNT",
                                    null,
                                    user == null ? null : user.getStatus().name(),
                                    "Access denied: account status is not Active"
                            );
                            return;
                        }

                        if (isPasswordExpired(user) && !isAuthEndpoint(request.getRequestURI())) {
                            writePasswordExpiredResponse(response);
                            return;
                        }



                        if (!isReauthenticateRequest) {
                            session.setLastActivityAt(now);
                            session.setStatus(AuthSession.SessionStatus.ACTIVE);
                            sessionRepository.save(session);
                        }

                        // F-02: permission-based overload — exemption is `security.maintenance.bypass`
                        // (or SYSTEM_SUPER_ADMIN), never a display role name. `user` is already
                        // resolved and confirmed Active above.
                        if (isMaintenanceBlocked(request.getRequestURI(), claims.principal(), user)) {
                            writeMaintenanceModeResponse(response);
                            return;
                        }

                        var permissions = permissionEvaluationService.getPermissionCodes(user);
                        var authenticatedPrincipal = new AuthenticatedUser(
                                claims.principal().userId(),
                                claims.principal().sessionId(),
                                claims.principal().username(),
                                claims.principal().role(),
                                permissions
                        );
                        var authentication = new UsernamePasswordAuthenticationToken(
                                authenticatedPrincipal,
                                null,
                                tokenService.toAuthorities(permissions)
                        );
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private void writeAccountNotActiveResponse(HttpServletResponse response, UserStatus status) {
        if (response.isCommitted()) {
            return;
        }
        String code = switch (status) {
            case Pending -> "ACCOUNT_PENDING_ACTIVATION";
            case Suspended -> "ACCOUNT_SUSPENDED";
            case Inactive -> "ACCOUNT_INACTIVE";
            case Terminated -> "ACCOUNT_TERMINATED";
            case Active -> "ACCOUNT_INACTIVE"; // unreachable: caller only invokes for non-Active/null
            case null -> "ACCOUNT_INACTIVE";
        };
        response.setStatus(401);
        response.setContentType("application/json");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", code,
                    "message", "Your account is not active. Please contact your administrator."
            )));
            response.flushBuffer();
        } catch (IOException ignored) {
            // Fall through without extra handling.
        }
    }

    private void writeSessionLockedResponse(HttpServletResponse response) {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(423);
        response.setContentType("application/json");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", "SESSION_LOCKED",
                    "message", "Session locked due to inactivity"
            )));
            response.flushBuffer();
        } catch (IOException ignored) {
            // Fall through without extra handling.
        }
    }

    private void writePasswordExpiredResponse(HttpServletResponse response) {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(401);
        response.setContentType("application/json");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", "PASSWORD_EXPIRED",
                    "message", "Password has expired. Please change your password."
            )));
            response.flushBuffer();
        } catch (IOException ignored) {
            // Fall through without extra handling.
        }
    }

    private void writeMfaSetupRequiredResponse(HttpServletResponse response) {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(401);
        response.setContentType("application/json");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", "MFA_SETUP_REQUIRED",
                    "message", "Two-factor authentication is required. Please set up 2FA."
            )));
            response.flushBuffer();
        } catch (IOException ignored) {
            // Fall through without extra handling.
        }
    }

    /**
     * F-02: maintenance exemption is permission-based (`security.maintenance.bypass`, or
     * SYSTEM_SUPER_ADMIN) — display role names are never consulted. `principal.permissions()`
     * is a fast path using the JWT's embedded snapshot; the `permissionEvaluationService` calls
     * are the authoritative fallback against the caller's live, fully-resolved account.
     */
    private boolean isMaintenanceBlocked(String requestUri, AuthenticatedUser principal, UserAccount user) {
        if (!systemConfigurationService.isMaintenanceModeEnabled()) {
            return false;
        }
        if (requestUri == null || requestUri.startsWith("/api/auth/")) {
            return false;
        }
        boolean principalHasBypass = principal != null && principal.permissions() != null
                && principal.permissions().stream().anyMatch(permission ->
                "security.maintenance.bypass".equalsIgnoreCase(permission));
        if (principalHasBypass || (user != null && (permissionEvaluationService.hasPermission(user, "security.maintenance.bypass")
                || permissionEvaluationService.isSuperAdmin(user)))) {
            return false;
        }
        return true;
    }

    private boolean isAuthEndpoint(String requestUri) {
        return requestUri != null && requestUri.startsWith("/api/auth/");
    }

    private boolean isPasswordExpired(UserAccount user) {
        return systemConfigurationService.isPasswordExpired(user);
    }

    private void writeMaintenanceModeResponse(HttpServletResponse response) {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(503);
        response.setContentType("application/json");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", "MAINTENANCE_MODE",
                    "message", "System is under maintenance. Please try again later."
            )));
            response.flushBuffer();
        } catch (IOException ignored) {
            // Fall through without extra handling.
        }
    }

    private void writeForbiddenResponse(HttpServletResponse response, String message) {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(403);
        response.setContentType("application/json");
        try {
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", "ACCESS_DENIED",
                    "message", message
            )));
            response.flushBuffer();
        } catch (IOException ignored) {
            // Fall through
        }
    }
}
