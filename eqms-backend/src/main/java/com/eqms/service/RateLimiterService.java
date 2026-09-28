package com.eqms.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.redis.core.StringRedisTemplate;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Redis-backed, per-client fixed-window rate limiter with a local fallback.
 *
 * <p>Redis is enabled by default so limits apply across every backend instance.
 * The local bucket remains only as a fail-safe when Redis is unavailable.</p>
 */
@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private final ConcurrentHashMap<String, RequestWindow> requestWindows = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RejectionWindow> rejectionWindows = new ConcurrentHashMap<>();
    private final int readMaxRequests;
    private final Duration readWindow;
    private final int writeMaxRequests;
    private final Duration writeWindow;
    private final int pollingMaxRequests;
    private final Duration pollingWindow;
    private final StringRedisTemplate redisTemplate;
    private final boolean redisEnabled;
    private final int authenticationMaxAttempts;
    private final Duration authenticationWindow;
    private final int passwordChangeMaxAttempts;
    private final Duration passwordChangeWindow;
    private final int signatureMaxAttempts;
    private final Duration signatureWindow;
    private final MeterRegistry meterRegistry;
    private final int rejectionWarningMinimumRequests;
    private final double rejectionWarningThreshold;
    private final Duration rejectionWarningWindow;

    @Autowired
    public RateLimiterService(
            @Value("${app.rate-limit.read.max-requests:900}") int readMaxRequests,
            @Value("${app.rate-limit.read.window-seconds:60}") long readWindowSeconds,
            @Value("${app.rate-limit.write.max-requests:180}") int writeMaxRequests,
            @Value("${app.rate-limit.write.window-seconds:60}") long writeWindowSeconds,
            @Value("${app.rate-limit.polling.max-requests:120}") int pollingMaxRequests,
            @Value("${app.rate-limit.polling.window-seconds:60}") long pollingWindowSeconds,
            @Value("${app.rate-limit.auth.max-attempts:5}") int authenticationMaxAttempts,
            @Value("${app.rate-limit.auth.window-seconds:900}") long authenticationWindowSeconds,
            @Value("${app.rate-limit.password-change.max-attempts:5}") int passwordChangeMaxAttempts,
            @Value("${app.rate-limit.password-change.window-seconds:900}") long passwordChangeWindowSeconds,
            @Value("${app.rate-limit.signature.max-attempts:20}") int signatureMaxAttempts,
            @Value("${app.rate-limit.signature.window-seconds:300}") long signatureWindowSeconds,
            @Value("${app.rate-limit.rejection-warning.minimum-requests:20}") int rejectionWarningMinimumRequests,
            @Value("${app.rate-limit.rejection-warning.threshold:0.50}") double rejectionWarningThreshold,
            @Value("${app.rate-limit.rejection-warning.window-seconds:60}") long rejectionWarningWindowSeconds,
            @Value("${app.rate-limit.redis.enabled:false}") boolean redisEnabled,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            ObjectProvider<MeterRegistry> meterRegistryProvider
    ) {
        this.readMaxRequests = Math.toIntExact(requirePositive(readMaxRequests, "app.rate-limit.read.max-requests"));
        this.readWindow = Duration.ofSeconds(requirePositive(readWindowSeconds, "app.rate-limit.read.window-seconds"));
        this.writeMaxRequests = Math.toIntExact(requirePositive(writeMaxRequests, "app.rate-limit.write.max-requests"));
        this.writeWindow = Duration.ofSeconds(requirePositive(writeWindowSeconds, "app.rate-limit.write.window-seconds"));
        this.pollingMaxRequests = Math.toIntExact(requirePositive(pollingMaxRequests, "app.rate-limit.polling.max-requests"));
        this.pollingWindow = Duration.ofSeconds(requirePositive(pollingWindowSeconds, "app.rate-limit.polling.window-seconds"));
        this.authenticationMaxAttempts = Math.toIntExact(requirePositive(authenticationMaxAttempts, "app.rate-limit.auth.max-attempts"));
        this.authenticationWindow = Duration.ofSeconds(requirePositive(authenticationWindowSeconds, "app.rate-limit.auth.window-seconds"));
        this.passwordChangeMaxAttempts = Math.toIntExact(requirePositive(passwordChangeMaxAttempts, "app.rate-limit.password-change.max-attempts"));
        this.passwordChangeWindow = Duration.ofSeconds(requirePositive(passwordChangeWindowSeconds, "app.rate-limit.password-change.window-seconds"));
        this.signatureMaxAttempts = Math.toIntExact(requirePositive(signatureMaxAttempts, "app.rate-limit.signature.max-attempts"));
        this.signatureWindow = Duration.ofSeconds(requirePositive(signatureWindowSeconds, "app.rate-limit.signature.window-seconds"));
        this.rejectionWarningMinimumRequests = Math.toIntExact(requirePositive(rejectionWarningMinimumRequests, "app.rate-limit.rejection-warning.minimum-requests"));
        this.rejectionWarningThreshold = requireRatio(rejectionWarningThreshold, "app.rate-limit.rejection-warning.threshold");
        this.rejectionWarningWindow = Duration.ofSeconds(requirePositive(rejectionWarningWindowSeconds, "app.rate-limit.rejection-warning.window-seconds"));
        this.redisEnabled = redisEnabled;
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
        this.meterRegistry = meterRegistryProvider.getIfAvailable();
    }

    /** Backward-compatible constructor for focused unit tests and local callers. */
    public RateLimiterService(int apiMaxRequests, long apiWindowSeconds, int authenticationMaxAttempts, long authenticationWindowSeconds) {
        this.readMaxRequests = Math.multiplyExact(apiMaxRequests, 10);
        this.readWindow = Duration.ofSeconds(apiWindowSeconds);
        this.writeMaxRequests = apiMaxRequests;
        this.writeWindow = Duration.ofSeconds(apiWindowSeconds);
        this.pollingMaxRequests = apiMaxRequests;
        this.pollingWindow = Duration.ofSeconds(apiWindowSeconds);
        this.authenticationMaxAttempts = authenticationMaxAttempts;
        this.authenticationWindow = Duration.ofSeconds(authenticationWindowSeconds);
        this.passwordChangeMaxAttempts = authenticationMaxAttempts;
        this.passwordChangeWindow = Duration.ofSeconds(authenticationWindowSeconds);
        this.signatureMaxAttempts = Math.max(authenticationMaxAttempts, 20);
        this.signatureWindow = Duration.ofSeconds(300);
        this.redisEnabled = false;
        this.redisTemplate = null;
        this.meterRegistry = null;
        this.rejectionWarningMinimumRequests = 20;
        this.rejectionWarningThreshold = 0.50;
        this.rejectionWarningWindow = Duration.ofSeconds(60);
    }

    public RateLimitResult checkApiRequest(String clientId) {
        return checkWriteRequest(clientId);
    }

    public RateLimitResult checkReadRequest(String clientId) {
        return check("read:" + normalizeClientId(clientId), readMaxRequests, readWindow);
    }

    public RateLimitResult checkWriteRequest(String clientId) {
        return check("write:" + normalizeClientId(clientId), writeMaxRequests, writeWindow);
    }

    public RateLimitResult checkPollingRequest(String clientId) {
        return check("polling:" + normalizeClientId(clientId), pollingMaxRequests, pollingWindow);
    }

    /**
     * @param action Distinguishes unrelated auth-adjacent endpoints (login, reauthenticate,
     *               mfa-verify, mfa-send-otp, forgot-password, reset-password) so they don't
     *               drain a single shared 5-attempts budget -- e.g. two mistyped login passwords
     *               should not eat into a legitimate MFA-code resend, and (for unauthenticated,
     *               IP-keyed clients) one careless user's failed attempts must not lock out a
     *               different colleague's unrelated action from behind the same office IP/NAT.
     */
    public RateLimitResult checkAuthenticationAttempt(String clientId, String action) {
        return check("auth:" + action + ":" + normalizeClientId(clientId), authenticationMaxAttempts, authenticationWindow);
    }

    /**
     * Applies two independent guards for unauthenticated credential flows: one per account
     * identifier (protects a targeted account even if an attacker rotates IPs), and one per
     * account-plus-origin (prevents a single NAT/VPN egress from making unrelated accounts share
     * a five-attempt budget). Identifiers are already SHA-256 digests when supplied by the filter.
     */
    public RateLimitResult checkAuthenticationAttempt(String clientIp, String action, String subjectDigest) {
        if (subjectDigest == null || subjectDigest.isBlank()) {
            return checkAuthenticationAttempt(clientIp, action);
        }
        RateLimitResult account = check("auth:" + action + ":account:" + subjectDigest,
                authenticationMaxAttempts, authenticationWindow);
        RateLimitResult originAndAccount = check("auth:" + action + ":origin:" + normalizeClientId(clientIp)
                        + ":account:" + subjectDigest,
                authenticationMaxAttempts, authenticationWindow);
        return mostRestrictive(account, originAndAccount);
    }

    /**
     * Electronic-signature password re-verification (POST /auth/verify-signature) is called on
     * every single e-signature confirmation across the whole app -- documents, security changes,
     * controlled copies, user management, audit export, email templates -- so a busy reviewer can
     * legitimately trigger it dozens of times per session. Sharing the 5-attempts/15-minutes
     * login brute-force bucket with it locks out real work after a handful of normal signatures.
     * This bucket is deliberately more generous (still bounded, so repeated password guessing is
     * still slowed down) and, like login, is cleared on a successful verification so mistyping a
     * password once doesn't count against a subsequent real signing session.
     */
    public RateLimitResult checkSignatureVerificationAttempt(String clientId) {
        return check("signature:" + normalizeClientId(clientId), signatureMaxAttempts, signatureWindow);
    }

    public void clearSignatureVerificationAttempts(String clientId) {
        clearKey("signature:" + normalizeClientId(clientId));
    }

    /**
     * A successful authentication is not a failed attempt and must not consume
     * the login budget.  The filter calls this after a successful auth response
     * so a user who briefly mistypes a password can continue normally after
     * signing in, while failed attempts remain protected by the five-attempt
     * window and the account lock policy.
     */
    public void clearAuthenticationAttempts(String clientId, String action) {
        clearKey("auth:" + action + ":" + normalizeClientId(clientId));
    }

    public void clearAuthenticationAttempts(String clientIp, String action, String subjectDigest) {
        if (subjectDigest == null || subjectDigest.isBlank()) {
            clearAuthenticationAttempts(clientIp, action);
            return;
        }
        clearKey("auth:" + action + ":account:" + subjectDigest);
        clearKey("auth:" + action + ":origin:" + normalizeClientId(clientIp) + ":account:" + subjectDigest);
    }

    public RateLimitResult checkPasswordChangeAttempt(String clientId) {
        return check("password-change:" + normalizeClientId(clientId), passwordChangeMaxAttempts, passwordChangeWindow);
    }

    public void clearPasswordChangeAttempts(String clientId) {
        clearKey("password-change:" + normalizeClientId(clientId));
    }

    private RateLimitResult check(String key, int maximum, Duration window) {
        String bucket = metricBucket(key);
        if (meterRegistry != null) {
            meterRegistry.counter("eqms.rate_limit.requests", "bucket", bucket).increment();
        }
        Instant now = Instant.now();
        if (redisEnabled && redisTemplate != null) {
            try {
                Long requests = redisTemplate.opsForValue().increment("eqms:rate-limit:" + key);
                if (requests != null && requests == 1L) {
                    redisTemplate.expire("eqms:rate-limit:" + key, window);
                }
                long retryAfter = Math.max(1, window.toSeconds());
                RateLimitResult result = new RateLimitResult(requests == null || requests <= maximum,
                        requests == null ? maximum : Math.max(0, maximum - requests.intValue()), retryAfter);
                if (!result.allowed() && meterRegistry != null) {
                    meterRegistry.counter("eqms.rate_limit.rejected", "bucket", bucket).increment();
                }
                recordRejectionRate(bucket, result.allowed(), now);
                return result;
            } catch (RuntimeException ignored) {
                // Redis is an optional production accelerator; retain safe local limiting
                // if it is temporarily unavailable during startup or a network partition.
            }
        }
        pruneExpiredWindows(now);
        RequestWindow current = requestWindows.compute(key, (ignored, existing) -> {
            if (existing == null || !existing.expiresAt().isAfter(now)) {
                return new RequestWindow(1, now.plus(window));
            }
            return new RequestWindow(existing.requests() + 1, existing.expiresAt());
        });

        long retryAfterSeconds = Math.max(1, Duration.between(now, current.expiresAt()).toSeconds() + 1);
        RateLimitResult result = new RateLimitResult(current.requests() <= maximum, Math.max(0, maximum - current.requests()), retryAfterSeconds);
        if (!result.allowed() && meterRegistry != null) {
            meterRegistry.counter("eqms.rate_limit.rejected", "bucket", bucket).increment();
        }
        recordRejectionRate(bucket, result.allowed(), now);
        return result;
    }

    private void pruneExpiredWindows(Instant now) {
        // A limiter key may never be requested again; remove such expired keys
        // opportunistically so a long-running server cannot accumulate clients.
        if (requestWindows.size() > 1_000) {
            requestWindows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        }
    }

    @Scheduled(fixedDelayString = "${app.rate-limit.local-fallback.cleanup-interval-ms:60000}")
    public void cleanupExpiredLocalWindows() {
        Instant now = Instant.now();
        requestWindows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        rejectionWindows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private RateLimitResult mostRestrictive(RateLimitResult first, RateLimitResult second) {
        if (!first.allowed()) return first;
        if (!second.allowed()) return second;
        return first.remaining() <= second.remaining() ? first : second;
    }

    private void clearKey(String key) {
        if (redisEnabled && redisTemplate != null) {
            try {
                redisTemplate.delete("eqms:rate-limit:" + key);
            } catch (RuntimeException ignored) {
                // The local fallback is cleared below even when Redis is unavailable.
            }
        }
        requestWindows.remove(key);
    }

    private String metricBucket(String key) {
        String[] segments = key.split(":", 3);
        return segments.length >= 2 && "auth".equals(segments[0]) ? "auth:" + segments[1] : segments[0];
    }

    private String normalizeClientId(String clientId) {
        return clientId == null || clientId.isBlank() ? "unknown" : clientId.trim();
    }

    private long requirePositive(long value, String property) {
        if (value <= 0) {
            throw new IllegalArgumentException(property + " must be greater than zero");
        }
        return value;
    }

    private double requireRatio(double value, String property) {
        if (value <= 0 || value > 1) {
            throw new IllegalArgumentException(property + " must be greater than 0 and at most 1");
        }
        return value;
    }

    private void recordRejectionRate(String bucket, boolean allowed, Instant now) {
        AtomicBoolean warn = new AtomicBoolean(false);
        RejectionWindow observation = rejectionWindows.compute(bucket, (ignored, existing) -> {
            RejectionWindow current = existing == null || !existing.expiresAt().isAfter(now)
                    ? new RejectionWindow(0, 0, false, now.plus(rejectionWarningWindow))
                    : existing;
            int requests = current.requests() + 1;
            int rejected = current.rejected() + (allowed ? 0 : 1);
            boolean warned = current.warned();
            if (!warned && requests >= rejectionWarningMinimumRequests
                    && ((double) rejected / requests) >= rejectionWarningThreshold) {
                warned = true;
                warn.set(true);
            }
            return new RejectionWindow(requests, rejected, warned, current.expiresAt());
        });
        if (warn.get()) {
            log.warn("Rate-limit rejection ratio is unusually high: bucket={}, rejected={}, requests={}, ratio={}",
                    bucket, observation.rejected(), observation.requests(),
                    String.format(java.util.Locale.ROOT, "%.2f", (double) observation.rejected() / observation.requests()));
        }
    }

    public record RateLimitResult(boolean allowed, int remaining, long retryAfterSeconds) {
    }

    private record RequestWindow(int requests, Instant expiresAt) {
    }

    private record RejectionWindow(int requests, int rejected, boolean warned, Instant expiresAt) {
    }
}
