package com.eqms.auth;

import com.eqms.service.RateLimiterService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.ByteArrayInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // Each path gets its own rate-limit bucket (see RateLimiterService.checkAuthenticationAttempt)
    // -- these are unrelated actions with different legitimate-use patterns, and must not drain
    // a single shared attempt budget.
    private static final Map<String, String> AUTHENTICATION_ATTEMPT_PATHS = Map.of(
            "/api/auth/login", "login",
            "/api/auth/reauthenticate", "reauthenticate",
            "/api/auth/mfa/verify", "mfa-verify",
            "/api/auth/mfa/send-email-otp", "mfa-send-otp",
            "/api/auth/forgot-password", "forgot-password",
            "/api/auth/reset-password", "reset-password"
    );

    private static final Set<String> SUCCESSFUL_AUTHENTICATION_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/reauthenticate",
            "/api/auth/mfa/verify"
    );

    // Electronic-signature password re-verification has its own, more generous bucket -- see
    // RateLimiterService.checkSignatureVerificationAttempt for why it can't share the login
    // brute-force bucket without locking out routine, legitimate e-signature usage.
    private static final String SIGNATURE_VERIFICATION_PATH = "/api/auth/verify-signature";
    private static final String PASSWORD_CHANGE_PATH = "/api/auth/me/change-password";
    private static final String CONTROLLED_COPY_PREVIEW_SUFFIX = "/preview";

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
    private final ObjectMapper objectMapper;

    @Autowired
    public RateLimitFilter(
            RateLimiterService rateLimiterService,
            @Value("${app.rate-limit.trust-forwarded-headers:false}") boolean trustForwardedHeaders,
            ObjectMapper objectMapper
    ) {
        this.rateLimiterService = rateLimiterService;
        this.trustForwardedHeaders = trustForwardedHeaders;
        this.objectMapper = objectMapper;
    }

    /** Constructor kept for focused filter tests without a Spring context. */
    RateLimitFilter(RateLimiterService rateLimiterService, boolean trustForwardedHeaders) {
        this(rateLimiterService, trustForwardedHeaders, new ObjectMapper());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authenticationAction = HttpMethod.POST.matches(request.getMethod())
                ? AUTHENTICATION_ATTEMPT_PATHS.get(request.getRequestURI())
                : null;
        HttpServletRequest effectiveRequest = authenticationAction == null
                ? request
                : new ReReadableBodyRequest(request);
        String clientId = resolveClientId(effectiveRequest);
        boolean authenticationAttempt = authenticationAction != null;
        boolean signatureVerificationAttempt = HttpMethod.POST.matches(request.getMethod())
                && SIGNATURE_VERIFICATION_PATH.equals(request.getRequestURI());
        boolean passwordChangeAttempt = HttpMethod.POST.matches(request.getMethod())
                && PASSWORD_CHANGE_PATH.equals(request.getRequestURI());
        boolean controlledCopyPreviewAttempt = isControlledCopyPreviewAttempt(request);
        boolean pollingRequest = HttpMethod.GET.matches(request.getMethod())
                && POLLING_EXEMPT_PATHS.contains(request.getRequestURI());
        String subjectDigest = authenticationAttempt ? resolveSubjectDigest(effectiveRequest, authenticationAction) : null;
        String previewTokenDigest = controlledCopyPreviewAttempt ? digestRequestParameter(request, "token") : null;
        RateLimiterService.RateLimitResult result = authenticationAttempt
                ? checkAuthenticationAttempt(clientId, effectiveRequest, authenticationAction, subjectDigest)
                : signatureVerificationAttempt
                    ? rateLimiterService.checkSignatureVerificationAttempt(clientId)
                : passwordChangeAttempt
                    ? rateLimiterService.checkPasswordChangeAttempt(clientId)
                : controlledCopyPreviewAttempt
                    ? rateLimiterService.checkAuthenticationAttempt(resolveClientIp(request), "controlled-copy-preview", previewTokenDigest)
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
            response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Please try again later.\"}");
            return;
        }

        filterChain.doFilter(effectiveRequest, response);

        // A successful login/reauthentication/MFA verification is not a failed
        // authentication attempt.  Clearing the attempt bucket prevents a few
        // earlier failed requests (or validation retries) from causing a valid
        // user to receive a misleading 429 after signing in successfully.
        if (authenticationAttempt
                && SUCCESSFUL_AUTHENTICATION_PATHS.contains(effectiveRequest.getRequestURI())
                && isSuccessfulAuthenticationResponse(response)) {
            clearAuthenticationAttempt(clientId, effectiveRequest, authenticationAction, subjectDigest);
        }

        // A correct e-signature password should not count against a user who mistyped it once
        // earlier in the same session -- only repeated failures (wrong-password guessing) should
        // consume the budget.
        if (signatureVerificationAttempt && response.getStatus() >= 200 && response.getStatus() < 300) {
            rateLimiterService.clearSignatureVerificationAttempts(clientId);
        }

        if (passwordChangeAttempt && response.getStatus() >= 200 && response.getStatus() < 300) {
            rateLimiterService.clearPasswordChangeAttempts(clientId);
        }

        if (controlledCopyPreviewAttempt && response.getStatus() >= 200 && response.getStatus() < 300) {
            rateLimiterService.clearAuthenticationAttempts(resolveClientIp(request), "controlled-copy-preview", previewTokenDigest);
        }
    }

    private RateLimiterService.RateLimitResult checkAuthenticationAttempt(
            String clientId, HttpServletRequest request, String action, String subjectDigest) {
        // Authenticated reauthentication has a stable user id. Public credential flows use a
        // digest of the account/challenge token plus the origin, so colleagues sharing a NAT do
        // not consume each other's budget while one account remains protected across IP rotation.
        if (subjectDigest == null) {
            return rateLimiterService.checkAuthenticationAttempt(clientId, action);
        }
        return rateLimiterService.checkAuthenticationAttempt(resolveClientIp(request), action, subjectDigest);
    }

    private void clearAuthenticationAttempt(
            String clientId, HttpServletRequest request, String action, String subjectDigest) {
        if (subjectDigest == null) {
            rateLimiterService.clearAuthenticationAttempts(clientId, action);
            return;
        }
        rateLimiterService.clearAuthenticationAttempts(resolveClientIp(request), action, subjectDigest);
    }

    private String resolveSubjectDigest(HttpServletRequest request, String action) {
        if (!(request instanceof ReReadableBodyRequest cachedRequest)) {
            return null;
        }
        try {
            JsonNode body = objectMapper.readTree(cachedRequest.body());
            if (body == null) return null;
            String value = switch (action) {
                case "login", "forgot-password" -> textValue(body, "identifier");
                case "reset-password", "mfa-send-otp", "mfa-verify" -> textValue(body, "token", "mfaToken");
                default -> null;
            };
            return value == null ? null : sha256(value);
        } catch (IOException | IllegalArgumentException ignored) {
            // Invalid payloads are still limited by the normal origin bucket. Controller-level
            // validation remains responsible for explaining the malformed request to the client.
            return null;
        }
    }

    private String textValue(JsonNode body, String... fields) {
        for (String field : fields) {
            String value = body.path(field).asText(null);
            if (value != null && !value.isBlank()) return value.trim();
        }
        return null;
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required by the JVM", impossible);
        }
    }

    private String digestRequestParameter(HttpServletRequest request, String parameter) {
        String value = request.getParameter(parameter);
        return value == null || value.isBlank() ? null : sha256(value.trim());
    }

    private boolean isControlledCopyPreviewAttempt(HttpServletRequest request) {
        if (!HttpMethod.GET.matches(request.getMethod())) return false;
        String path = request.getRequestURI();
        return path.startsWith("/api/controlled-copies/")
                && path.endsWith(CONTROLLED_COPY_PREVIEW_SUFFIX)
                && !path.endsWith(CONTROLLED_COPY_PREVIEW_SUFFIX + "/");
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

    /**
     * Reads a small JSON authentication payload once and exposes a fresh stream for every
     * consumer. This lets the rate-limit filter inspect the login identifier without consuming
     * the controller's request body (unlike reading directly from the original request stream).
     */
    private static final class ReReadableBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private ReReadableBodyRequest(HttpServletRequest request) throws IOException {
            super(request);
            this.body = request.getInputStream().readAllBytes();
        }

        private byte[] body() {
            return body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { }
                @Override public int read() { return input.read(); }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding() == null ? StandardCharsets.UTF_8.name() : getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.Charset.forName(encoding)));
        }
    }
}
