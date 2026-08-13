package com.eqms.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

/** Prevents duplicate high-impact mutations when a client retries or double-submits. */
@Component
public class IdempotencyFilter extends OncePerRequestFilter {
    private static final Set<String> METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Duration RESULT_TTL = Duration.ofMinutes(15);
    private static final Duration LOCK_TTL = Duration.ofSeconds(45);
    private final StringRedisTemplate redis;
    private final boolean enabled;

    public IdempotencyFilter(
            ObjectProvider<StringRedisTemplate> redisProvider,
            @org.springframework.beans.factory.annotation.Value("${app.idempotency.redis.enabled:false}") boolean enabled
    ) {
        this.redis = redisProvider.getIfAvailable();
        this.enabled = enabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String idempotencyKey = request.getHeader("Idempotency-Key");
        if (!enabled || redis == null || !METHODS.contains(request.getMethod()) || idempotencyKey == null || idempotencyKey.isBlank()
                || !isProtectedMutation(request.getRequestURI())) {
            chain.doFilter(request, response);
            return;
        }

        String scope = request.getUserPrincipal() == null ? request.getRemoteAddr() : request.getUserPrincipal().getName();
        // A key belongs to one authenticated actor *and* one exact mutation.
        // Reusing a browser-generated key on a different endpoint must never
        // replay a response from the earlier action.
        String operation = request.getMethod() + ":" + request.getRequestURI();
        String base = "eqms:idempotency:" + UUID.nameUUIDFromBytes(
                (scope + ":" + operation + ":" + idempotencyKey.trim()).getBytes(StandardCharsets.UTF_8)
        );
        String resultKey = base + ":result";
        String lockKey = base + ":lock";
        boolean requestPassedToChain = false;
        try {
            String cached = redis.opsForValue().get(resultKey);
            if (cached != null) {
                replay(cached, response);
                response.setHeader("Idempotency-Replayed", "true");
                return;
            }
            if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(lockKey, "processing", LOCK_TTL))) {
                response.setStatus(HttpServletResponse.SC_CONFLICT);
                response.setContentType("application/json");
                response.getWriter().write("{\"code\":\"IDEMPOTENCY_IN_PROGRESS\",\"message\":\"An identical operation is already being processed.\"}");
                return;
            }
            ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
            try {
                requestPassedToChain = true;
                chain.doFilter(request, wrapped);
                try {
                    String body = Base64.getEncoder().encodeToString(wrapped.getContentAsByteArray());
                    String contentType = wrapped.getContentType() == null ? "" : wrapped.getContentType();
                    redis.opsForValue().set(resultKey, wrapped.getStatus() + "|"
                            + Base64.getEncoder().encodeToString(contentType.getBytes(StandardCharsets.UTF_8))
                            + "|" + body, RESULT_TTL);
                } catch (RuntimeException ignored) {
                    // A Redis outage may disable replay protection temporarily,
                    // but must never discard an already-completed business response.
                } finally {
                    wrapped.copyBodyToResponse();
                }
            } finally {
                try {
                    redis.delete(lockKey);
                } catch (RuntimeException ignored) {
                    // Lock expiry remains the safe fallback when Redis is unavailable.
                }
            }
        } catch (RuntimeException unavailable) {
            // Redis is optional during local development; never make business APIs unavailable
            // solely because the idempotency store is down.
            if (!requestPassedToChain) chain.doFilter(request, response);
        }
    }

    private void replay(String serialized, HttpServletResponse response) throws IOException {
        String[] parts = serialized.split("\\|", 3);
        if (parts.length != 3) return;
        response.setStatus(Integer.parseInt(parts[0]));
        String contentType = new String(Base64.getDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        if (!contentType.isBlank()) response.setContentType(contentType);
        response.getOutputStream().write(Base64.getDecoder().decode(parts[2]));
    }

    private boolean isProtectedMutation(String uri) {
        return uri != null && (uri.contains("/documents") || uri.contains("/revisions") || uri.contains("/publishing")
                || uri.contains("/controlled-copies") || uri.contains("/electronic-signature") || uri.contains("/workflow"));
    }
}
