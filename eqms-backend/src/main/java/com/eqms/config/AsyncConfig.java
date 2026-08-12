package com.eqms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Dedicated executor for latency-sensitive email dispatch (MFA/login OTP codes) so it never
 * queues behind heavier @Async work — publishing/e-signature package generation, revision
 * snapshots, controlled-copy batch distribution — which all share the default
 * applicationTaskExecutor and can occupy it for seconds to minutes at a time.
 */
@Configuration
public class AsyncConfig {

    @Bean(name = "mfaEmailExecutor")
    public TaskExecutor mfaEmailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("eqms-mfa-email-");
        executor.initialize();
        return executor;
    }
}
