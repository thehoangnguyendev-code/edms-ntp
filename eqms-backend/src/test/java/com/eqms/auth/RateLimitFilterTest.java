package com.eqms.auth;

import com.eqms.service.RateLimiterService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;

import java.util.concurrent.atomic.AtomicInteger;
import java.nio.charset.StandardCharsets;

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

    @Test
    void loginLimitIsPerAccountWhenUsersShareTheSameNatAndBodyReachesController() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiterService(100, 60, 5, 15 * 60), false);
        String aliceBody = "{\"identifier\":\"alice@example.test\",\"password\":\"wrong\"}";

        for (int attempt = 0; attempt < 5; attempt++) {
            MockHttpServletResponse response = filterLogin(filter, "192.0.2.1", aliceBody, null);
            assertEquals(200, response.getStatus());
        }
        assertEquals(429, filterLogin(filter, "192.0.2.1", aliceBody, null).getStatus());

        // Bob uses the same NAT but must not inherit Alice's failed-login counter.
        assertEquals(200, filterLogin(filter, "192.0.2.1",
                "{\"identifier\":\"bob@example.test\",\"password\":\"wrong\"}", null).getStatus());

        // The body was inspected by the filter and is still intact for Spring MVC/controller.
        AtomicInteger controllerCalls = new AtomicInteger();
        String carolBody = "{\"identifier\":\"carol@example.test\",\"password\":\"wrong\"}";
        MockHttpServletResponse response = filterLogin(filter, "192.0.2.1", carolBody, request -> {
            controllerCalls.incrementAndGet();
            assertEquals(carolBody, request.getReader().readLine());
        });
        assertEquals(200, response.getStatus());
        assertEquals(1, controllerCalls.get());
    }

    private MockHttpServletResponse filterLogin(RateLimitFilter filter, AtomicInteger downstreamCalls) throws Exception {
        return filterLogin(filter, "192.0.2.1", "", request -> downstreamCalls.incrementAndGet());
    }

    private MockHttpServletResponse filterLogin(
            RateLimitFilter filter, String ip, String body,
            ThrowingRequestConsumer downstream) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(ip);
        request.setContentType("application/json");
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> {
            if (downstream != null) {
                downstream.accept((HttpServletRequest) ignoredRequest);
            }
        });
        return response;
    }

    @FunctionalInterface
    private interface ThrowingRequestConsumer {
        void accept(HttpServletRequest request) throws java.io.IOException;
    }
}
