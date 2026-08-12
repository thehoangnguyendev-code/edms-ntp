package com.eqms.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.StringRedisTemplate;
import io.micrometer.core.instrument.MeterRegistry;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Redis-backed, per-client fixed-window rate limiter with a local fallback.
 *
 * <p>Redis is enabled by default so limits apply across every backend instance.
 * The local bucket remains only as a fail-safe when Redis is unavailable.</p>
 */
@Service
public class RateLimiterService {

    private final ConcurrentHashMap<String, RequestWindow> requestWindows = new ConcurrentHashMap<>();
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
    private final MeterRegistry meterRegistry;

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
        this.redisEnabled = false;
        this.redisTemplate = null;
        this.meterRegistry = null;
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

    public RateLimitResult checkAuthenticationAttempt(String clientId) {
        return check("auth:" + normalizeClientId(clientId), authenticationMaxAttempts, authenticationWindow);
    }

    /**
     * A successful authentication is not a failed attempt and must not consume
     * the login budget.  The filter calls this after a successful auth response
     * so a user who briefly mistypes a password can continue normally after
     * signing in, while failed attempts remain protected by the five-attempt
     * window and the account lock policy.
     */
    public void clearAuthenticationAttempts(String clientId) {
        String key = "auth:" + normalizeClientId(clientId);
        String redisKey = "eqms:rate-limit:" + key;
        if (redisEnabled && redisTemplate != null) {
            try {
                redisTemplate.delete(redisKey);
            } catch (RuntimeException ignored) {
                // The local bucket is still cleared below when Redis is unavailable.
            }
        }
        requestWindows.remove(key);
    }

    private RateLimitResult check(String key, int maximum, Duration window) {
        String bucket = key.contains(":") ? key.substring(0, key.indexOf(':')) : "unknown";
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
        return result;
    }

    private void pruneExpiredWindows(Instant now) {
        // A limiter key may never be requested again; remove such expired keys
        // opportunistically so a long-running server cannot accumulate clients.
        if (requestWindows.size() > 1_000) {
            requestWindows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        }
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

    public record RateLimitResult(boolean allowed, int remaining, long retryAfterSeconds) {
    }

    private record RequestWindow(int requests, Instant expiresAt) {
    }
}
