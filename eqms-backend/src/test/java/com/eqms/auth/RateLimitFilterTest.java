package com.eqms.auth;

import com.eqms.service.RateLimiterService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimitFilterTest {

    @Test
    void returns429OnTheSixthLoginAttempt() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiterService(100, 60, 5, 15 * 60), false);
        AtomicInteger downstreamCalls = new AtomicInteger();

        for (int attempt = 0; attempt < 5; attempt++) {
            MockHttpServletResponse response = filterLogin(filter, downstreamCalls);
            assertEquals(200, response.getStatus());
        }

        MockHttpServletResponse blocked = filterLogin(filter, downstreamCalls);
        assertEquals(429, blocked.getStatus());
        assertTrue(blocked.getContentAsString().contains("RATE_LIMITED"));
        assertEquals(5, downstreamCalls.get());
    }

    @Test
    void limitsNonAuthenticationEndpointsUsingTheGeneralLimit() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiterService(1, 60, 5, 15 * 60), false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/documents");
        request.setRemoteAddr("192.0.2.2");
        filter.doFilter(request, new MockHttpServletResponse(), (ignoredRequest, ignoredResponse) -> { });

        MockHttpServletRequest secondRequest = new MockHttpServletRequest("POST", "/api/documents");
        secondRequest.setRemoteAddr("192.0.2.2");
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(secondRequest, blocked, (ignoredRequest, ignoredResponse) -> { });

        assertEquals(429, blocked.getStatus());
    }

    private MockHttpServletResponse filterLogin(RateLimitFilter filter, AtomicInteger downstreamCalls) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("192.0.2.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> downstreamCalls.incrementAndGet());
        return response;
    }
}
