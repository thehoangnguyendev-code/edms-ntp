package com.eqms.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @Bean
    public RedisCacheManager cacheManager(
            RedisConnectionFactory connectionFactory,
            @Value("${spring.cache.redis.time-to-live:30s}") Duration ttl) {
        // The default (no-arg) serializer's internal ObjectMapper has no java.time support --
        // caching ANY value with an Instant/LocalDate/... field (e.g. a JPA entity's
        // createdAt/updatedAt) throws InvalidDefinitionException. That failure surfaced for real
        // caching ControlledCopyPolicySetting, and is not specific to that one entity: register
        // JavaTimeModule via .configure(...) so every current and future @Cacheable value
        // serializes, while keeping Spring's own default type-info handling (needed to
        // deserialize back to the correct concrete type) intact -- do NOT build a fresh
        // ObjectMapper by hand here, it would have to reimplement that correctly too.
        var jsonSerializer = new GenericJackson2JsonRedisSerializer()
                .configure(mapper -> mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule()));
        RedisCacheConfiguration configuration = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(ttl)
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(
                        org.springframework.data.redis.serializer.StringRedisSerializer.UTF_8))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));
        // NOT .transactionAware(): that defers cache put/evict into a post-commit
        // TransactionSynchronization callback which runs OUTSIDE the normal caching-aspect path --
        // a failure there (e.g. this exact serialization bug, or a Redis blip) is NOT routed
        // through errorHandler() below and propagates uncaught, turning an already-committed,
        // successful write (e.g. a submitted Controlled Copy request) into a 500 response to the
        // caller. Going through the normal (non-deferred) path keeps every cache operation --
        // reads AND writes -- covered by the same fail-safe error handler.
        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(configuration)
                .build();
    }

    /**
     * Every @Cacheable in this app backs onto Redis. Spring's default error handler RETHROWS a
     * cache get/put/evict failure -- meaning a Redis blip would not just make a cached read
     * slower, it would make the ANNOTATED METHOD ITSELF throw, breaking whatever feature calls it
     * (e.g. every single Controlled Copy authorization check, once policy caching was added here).
     * A cache is an optimization; it must never be a new single point of failure for functionality
     * that worked fine without it. Log and fail through to the real method (cache miss) instead.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Cache GET failed for cache '{}' key '{}' -- falling through to the real method: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Cache PUT failed for cache '{}' key '{}' -- result was computed correctly but won't be cached: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Cache EVICT failed for cache '{}' key '{}' -- a stale cached value may persist until its TTL expires: {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Cache CLEAR failed for cache '{}' -- stale cached values may persist until their TTL expires: {}",
                        cache.getName(), exception.getMessage());
            }
        };
    }
}
