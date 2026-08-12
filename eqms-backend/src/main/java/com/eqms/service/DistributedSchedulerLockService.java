package com.eqms.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * A small Redis-backed lease for scheduled work that must run once across all
 * EQMS backend instances.  Jobs use a unique owner token so one instance never
 * releases a lease acquired by another instance after a delayed execution.
 */
@Service
public class DistributedSchedulerLockService {

    private static final String PREFIX = "eqms:scheduler-lock:";
    private static final DefaultRedisScript<Long> RELEASE_IF_OWNER = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class
    );

    private final StringRedisTemplate redis;
    private final boolean enabled;

    public DistributedSchedulerLockService(
            ObjectProvider<StringRedisTemplate> redisProvider,
            @Value("${app.scheduler-lock.redis.enabled:${APP_RATE_LIMIT_REDIS_ENABLED:true}}") boolean enabled
    ) {
        this.redis = redisProvider.getIfAvailable();
        this.enabled = enabled;
    }

    /**
     * Returns an acquired lease or a non-acquired lease. When Redis locking is
     * explicitly disabled, a no-op acquired lease supports a documented
     * single-instance/local deployment. When it is enabled but unavailable, the
     * caller must skip the job rather than risk duplicate regulated actions.
     */
    public SchedulerLease tryAcquire(String jobName, Duration ttl) {
        if (!enabled) {
            return SchedulerLease.acquiredNoop();
        }
        if (redis == null || ttl == null || ttl.isZero() || ttl.isNegative()) {
            return SchedulerLease.notAcquired();
        }

        String owner = UUID.randomUUID().toString();
        String key = PREFIX + jobName;
        try {
            boolean acquired = Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, owner, ttl));
            return acquired ? new SchedulerLease(redis, key, owner, true) : SchedulerLease.notAcquired();
        } catch (RuntimeException unavailable) {
            return SchedulerLease.notAcquired();
        }
    }

    public static final class SchedulerLease implements AutoCloseable {
        private final StringRedisTemplate redis;
        private final String key;
        private final String owner;
        private final boolean acquired;

        private SchedulerLease(StringRedisTemplate redis, String key, String owner, boolean acquired) {
            this.redis = redis;
            this.key = key;
            this.owner = owner;
            this.acquired = acquired;
        }

        private static SchedulerLease acquiredNoop() {
            return new SchedulerLease(null, null, null, true);
        }

        private static SchedulerLease notAcquired() {
            return new SchedulerLease(null, null, null, false);
        }

        public boolean acquired() {
            return acquired;
        }

        @Override
        public void close() {
            if (!acquired || redis == null) {
                return;
            }
            try {
                redis.execute(RELEASE_IF_OWNER, List.of(key), owner);
            } catch (RuntimeException ignored) {
                // TTL remains the safe fallback if Redis is briefly unavailable.
            }
        }
    }
}
