package com.eqms.config;

import com.eqms.service.NavigationTaskCountCache;
import com.eqms.service.NotificationRealtimeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Set;

/**
 * Pushes "the menu counts changed" to the connected browsers when a command finished on one of the areas that have a count but announce no changed record: access reviews,
 * periodic reviews of the audit trail and report templates. Training, documents, revisions and copies already announce theirs (EntityChangeBroadcaster).
 * The event carries no data: each browser asks for its own counts.
 */
@Configuration
public class TaskCountRealtimeConfig implements WebMvcConfigurer {
    static final String EVENT = "task-counts-changed";
    private static final Set<String> READS = Set.of("GET", "HEAD", "OPTIONS");

    private final ObjectProvider<NotificationRealtimeService> realtime;
    private final ObjectProvider<NavigationTaskCountCache> cache;

    /** Providers, so that a test of the web layer alone, which has neither service, can still start. */
    public TaskCountRealtimeConfig(ObjectProvider<NotificationRealtimeService> realtime, ObjectProvider<NavigationTaskCountCache> cache) {
        this.realtime = realtime;
        this.cache = cache;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
                if (ex != null || READS.contains(request.getMethod()) || response.getStatus() >= 400) return;
                // before the browsers are told, so that what they read next is not what was kept
                cache.ifAvailable(NavigationTaskCountCache::clear);
                realtime.ifAvailable(service -> service.publishGlobalEvent(EVENT));
            }
        }).addPathPatterns("/security/access-reviews/**", "/audit-trail/reviews/**", "/reports/templates/**");
    }
}
