package com.eqms.config;

import com.eqms.service.EntityChangeBroadcaster;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

/**
 * Tells every connected client, over the existing server-sent-events stream, that something in Training Management or Training Administration changed, so the lists and
 * the detail screens refresh themselves (see {@link EntityChangeBroadcaster}: the event carries no data, each client reads again through its own authorised calls).
 * It is sent when a command (a request that is not a read) of the Training API has finished without an error; the services have committed by then.
 */
@Configuration
public class TrainingRealtimeConfig implements WebMvcConfigurer {
    private static final Set<String> READS = Set.of("GET", "HEAD", "OPTIONS");

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
                if (ex != null || READS.contains(request.getMethod()) || response.getStatus() >= 400) return;
                // The same id for the same address, so a burst of calls to one resource is one event.
                EntityChangeBroadcaster.changed("TRAINING", UUID.nameUUIDFromBytes(request.getRequestURI().getBytes(StandardCharsets.UTF_8)), null);
            }
        }).addPathPatterns("/training/**");
    }
}
