package com.eqms.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Supplies a request start time so audit events can include their actual progress duration. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuditRequestTimingFilter extends OncePerRequestFilter {
    public static final String REQUEST_START_NANOS_ATTRIBUTE = AuditRequestTimingFilter.class.getName() + ".startNanos";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        request.setAttribute(REQUEST_START_NANOS_ATTRIBUTE, System.nanoTime());
        filterChain.doFilter(request, response);
    }
}
