package com.eqms.auth;

import com.eqms.service.RateLimiterService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.Set;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> AUTHENTICATION_ATTEMPT_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/reauthenticate",
            "/api/auth/mfa/verify",
            "/api/auth/mfa/send-email-otp",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/verify-signature"
    );

    private static final Set<String> SUCCESSFUL_AUTHENTICATION_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/reauthenticate",
            "/api/auth/mfa/verify"
    );

    /**
     * Lightweight, read-only endpoints that every authenticated tab polls automatically
     * every ~30s (navigation, branding, localization, notification badge). These are cheap
     * and their call rate is inherently bounded by the polling interval, so they are excluded
     * from the shared general-API counter — otherwise a handful of open tabs/users behind the
     * same client identity could exhaust the budget through background polling alone, blocking
     * genuine user-initiated actions.
     */
    private static final Set<String> POLLING_EXEMPT_PATHS = Set.of(
            "/api/navigation",
            "/api/branding",
            "/api/localization",
            "/api/notifications/summary"
    );

    private final RateLimiterService rateLimiterService;
    private final boolean trustForwardedHeaders;

    public RateLimitFilter(
            RateLimiterService rateLimiterService,
            @Value("${app.rate-limit.trust-forwarded-headers:false}") boolean trustForwardedHeaders
    ) {
        this.rateLimiterService = rateLimiterService;
        this.trustForwardedHeaders = trustForwardedHeaders;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String clientId = resolveClientId(request);
        boolean authenticationAttempt = HttpMethod.POST.matches(request.getMethod())
                && AUTHENTICATION_ATTEMPT_PATHS.contains(request.getRequestURI());
        boolean pollingRequest = HttpMethod.GET.matches(request.getMethod())
                && POLLING_EXEMPT_PATHS.contains(request.getRequestURI());
        RateLimiterService.RateLimitResult result = authenticationAttempt
                ? rateLimiterService.checkAuthenticationAttempt(clientId)
                : pollingRequest
                    ? rateLimiterService.checkPollingRequest(clientId)
                : isReadRequest(request)
                    ? rateLimiterService.checkReadRequest(clientId)
                    : rateLimiterService.checkWriteRequest(clientId);

        response.setHeader("X-RateLimit-Remaining", Integer.toString(result.remaining()));
        if (!result.allowed()) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(result.retryAfterSeconds()));
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\""
                    + escapeJson(localizedMessage(request)) + "\"}");
            return;
        }

        filterChain.doFilter(request, response);

        // A successful login/reauthentication/MFA verification is not a failed
        // authentication attempt.  Clearing the attempt bucket prevents a few
        // earlier failed requests (or validation retries) from causing a valid
        // user to receive a misleading 429 after signing in successfully.
        if (authenticationAttempt
                && SUCCESSFUL_AUTHENTICATION_PATHS.contains(request.getRequestURI())
                && isSuccessfulAuthenticationResponse(response)) {
            rateLimiterService.clearAuthenticationAttempts(clientId);
        }
    }

    private boolean isSuccessfulAuthenticationResponse(HttpServletResponse response) {
        if (response.getStatus() < 200 || response.getStatus() >= 300) {
            return false;
        }
        // AuthController sets the access-token cookie only after a complete
        // authentication.  A plain 2xx response is not sufficient: tests,
        // proxies and failed challenge handlers may return 2xx without a
        // session, and must not reset the brute-force bucket.
        return response.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .anyMatch(cookie -> cookie.startsWith("accessToken="));
    }

    private boolean isReadRequest(HttpServletRequest request) {
        return HttpMethod.GET.matches(request.getMethod()) || HttpMethod.HEAD.matches(request.getMethod());
    }

    private String localizedMessage(HttpServletRequest request) {
        Locale locale = Locale.ENGLISH;
        String acceptLanguage = request.getHeader(HttpHeaders.ACCEPT_LANGUAGE);
        if (acceptLanguage != null && acceptLanguage.toLowerCase(Locale.ROOT).startsWith("vi")) {
            locale = Locale.forLanguageTag("vi");
        }
        try {
            return ResourceBundle.getBundle("messages", locale).getString("errors.rate_limited");
        } catch (Exception ignored) {
            return "Too many requests. Please try again later.";
        }
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /**
     * Prefers the authenticated user's identity (set by {@link AuthTokenFilter}, which now runs
     * before this filter) so the budget is per-user, not per-IP — otherwise every user behind
     * the same office NAT/proxy would share one bucket. Authentication-attempt endpoints (login,
     * password reset, etc.) have no authenticated principal yet, so those fall back to IP, which
     * is the correct anti-brute-force behavior for that specific bucket.
     */
    private String resolveClientId(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser) {
            return "user:" + authenticatedUser.userId();
        }
        return "ip:" + resolveClientIp(request);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (trustForwardedHeaders) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                return forwardedFor.split(",", 2)[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
