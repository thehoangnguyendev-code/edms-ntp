package com.eqms.service;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

/**
 * Keeps the menu counts of a person for a few seconds, so that moving from page to page does not count everything again. Only numbers are kept, never anything that grants access.
 * Every request that can change something (anything but GET, HEAD and OPTIONS), by anybody, throws all of them away, so a person sees the effect of their own action at once;
 * while such a request is running nothing is kept at all, because its answer can reach the browser before the request has ended here. A change a background job announces
 * (EntityChangeBroadcaster) throws them away too; one it does not announce shows when the few seconds are over. The cache is in the memory of this server.
 */
@Component
public class NavigationTaskCountCache extends OncePerRequestFilter {
    static final Duration KEEP = Duration.ofSeconds(10);
    private static final Set<String> READ_ONLY = Set.of("GET", "HEAD", "OPTIONS");

    private record Entry(Object value, long expiresAtNanos, long generation) {}

    private final Map<UUID, Entry> entries = new ConcurrentHashMap<>();
    private final AtomicLong generation = new AtomicLong();
    private final AtomicInteger writing = new AtomicInteger();
    private final LongSupplier nanos;

    @Autowired
    public NavigationTaskCountCache() {
        this(System::nanoTime);
    }

    NavigationTaskCountCache(LongSupplier nanos) {
        this.nanos = nanos;
    }

    @SuppressWarnings("unchecked")
    public <T> T get(UUID userId, Supplier<T> count) {
        long now = nanos.getAsLong();
        long current = generation.get();
        Entry entry = entries.get(userId);
        if (entry != null && entry.generation() == current && entry.expiresAtNanos() - now > 0) return (T) entry.value();
        T value = count.get();
        // Stamped with the generation read before counting: a change made while counting leaves this entry already stale.
        if (writing.get() == 0) entries.put(userId, new Entry(value, now + KEEP.toNanos(), current));
        return value;
    }

    public void clear() {
        generation.incrementAndGet();
        entries.clear();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        // the heartbeat of an open session changes no record, and every browser sends it
        if (READ_ONLY.contains(request.getMethod()) || request.getRequestURI().endsWith("/auth/session/heartbeat")) {
            chain.doFilter(request, response);
            return;
        }
        writing.incrementAndGet();
        clear();
        try {
            chain.doFilter(request, response);
        } finally {
            clear();
            writing.decrementAndGet();
        }
    }
}
