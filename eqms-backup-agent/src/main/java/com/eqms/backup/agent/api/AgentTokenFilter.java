package com.eqms.backup.agent.api;

import com.eqms.backup.agent.config.AgentProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Only the eQMS backend may call /internal. It presents a shared secret; if no secret is configured every call is refused
 * (the agent fails closed, it never serves unauthenticated).
 */
@Component
public class AgentTokenFilter extends OncePerRequestFilter {

    private final byte[] expected;

    public AgentTokenFilter(AgentProperties properties) {
        this.expected = properties.getApiToken().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String presented = request.getHeader("X-Agent-Token");
        boolean ok = expected.length >= 16 && presented != null
                && MessageDigest.isEqual(expected, presented.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"AGENT_UNAUTHORIZED\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
