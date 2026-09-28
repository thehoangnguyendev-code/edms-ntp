package com.eqms.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimiterServiceTest {

    @Test
    void blocksTheSixthAuthenticationAttemptWithinTheConfiguredWindow() {
        RateLimiterService limiter = new RateLimiterService(100, 60, 5, 15 * 60);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1", "login").allowed());
        }

        RateLimiterService.RateLimitResult blocked = limiter.checkAuthenticationAttempt("192.0.2.1", "login");
        assertFalse(blocked.allowed());
        assertTrue(blocked.retryAfterSeconds() > 0);
    }

    @Test
    void keepsAuthenticationAndGeneralApiLimitsSeparate() {
        RateLimiterService limiter = new RateLimiterService(1, 60, 5, 15 * 60);

        assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1", "login").allowed());
        assertTrue(limiter.checkApiRequest("192.0.2.1").allowed());
        assertFalse(limiter.checkApiRequest("192.0.2.1").allowed());
    }

    @Test
    void keepsDistinctAuthenticationActionsFromSharingOneBudget() {
        // Regression test: login/reauthenticate/mfa-verify/mfa-send-otp/forgot-password/
        // reset-password used to share a single "auth:<clientId>" bucket, so exhausting the
        // budget on one unrelated action (e.g. a few mistyped login passwords) could lock out a
        // different action (e.g. resending an MFA code) for the same client -- or, worse, lock
        // out a different user entirely on IP-keyed unauthenticated buckets.
        RateLimiterService limiter = new RateLimiterService(100, 60, 5, 15 * 60);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1", "login").allowed());
        }
        assertFalse(limiter.checkAuthenticationAttempt("192.0.2.1", "login").allowed());

        // A fresh budget for a different action from the very same client.
        assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1", "mfa-send-otp").allowed());
    }

    @Test
    void isolatesAccountsSharingTheSameNatButProtectsOneAccountAcrossOrigins() {
        RateLimiterService limiter = new RateLimiterService(100, 60, 5, 15 * 60);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1", "login", "alice-digest").allowed());
        }
        assertFalse(limiter.checkAuthenticationAttempt("192.0.2.1", "login", "alice-digest").allowed());

        // A colleague behind the same office NAT has an independent account budget.
        assertTrue(limiter.checkAuthenticationAttempt("192.0.2.1", "login", "bob-digest").allowed());
        // Rotating the source IP cannot evade the account-level guard for Alice.
        assertFalse(limiter.checkAuthenticationAttempt("198.51.100.9", "login", "alice-digest").allowed());
    }

    @Test
    void keepsPasswordChangeAttemptsOutOfTheGeneralWriteBudgetAndClearsOnSuccess() {
        RateLimiterService limiter = new RateLimiterService(1, 60, 2, 15 * 60);

        assertTrue(limiter.checkPasswordChangeAttempt("user:42").allowed());
        assertTrue(limiter.checkWriteRequest("user:42").allowed());
        assertFalse(limiter.checkWriteRequest("user:42").allowed());

        limiter.clearPasswordChangeAttempts("user:42");
        assertTrue(limiter.checkPasswordChangeAttempt("user:42").allowed());
    }
}
