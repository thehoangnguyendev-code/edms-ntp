package com.eqms.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimiterServiceTest {

    @Test
    void blocksTheSixthAuthenticationAttemptWithinTheConfiguredWindow() {
        RateLimiterService limiter = new RateLimiterService(100, 60, 5, 15 * 60);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1").allowed());
        }

        RateLimiterService.RateLimitResult blocked = limiter.checkAuthenticationAttempt("192.0.2.1");
        assertFalse(blocked.allowed());
        assertTrue(blocked.retryAfterSeconds() > 0);
    }

    @Test
    void keepsAuthenticationAndGeneralApiLimitsSeparate() {
        RateLimiterService limiter = new RateLimiterService(1, 60, 5, 15 * 60);

        assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1").allowed());
        assertTrue(limiter.checkApiRequest("192.0.2.1").allowed());
        assertFalse(limiter.checkApiRequest("192.0.2.1").allowed());
    }
}
