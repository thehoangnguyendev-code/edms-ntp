package com.eqms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Dedicated executors per workload shape, so unrelated background work no longer competes for one
 * shared pool (the default applicationTaskExecutor, core=4/max=8/queue=100 from
 * application.properties) — previously a slow controlled-copy batch distribution for one admin
 * could queue behind/starve a revision snapshot or publishing-package job for a completely
 * unrelated user, and vice versa. Workloads are grouped by what actually limits their throughput,
 * not just "CPU vs I/O" in the abstract:
 *
 * - mfaEmailExecutor: unchanged (latency-sensitive OTP emails, must never wait behind anything).
 * - fileProcessingExecutor: single heavy PDF/DOCX composition jobs (publishing workspace,
 *   revision snapshot) — CPU/IO-bound per job, kept small so concurrent jobs don't thrash.
 * - controlledCopyBatchExecutor: batch operations that loop over many (potentially hundreds of)
 *   controlled copies doing file + notification work per item — sized larger since a single batch
 *   can legitimately want several worker threads to make progress, and multiple admins may kick
 *   off batches concurrently.
 * - integrationExecutor: outbound calls to external systems (SharePoint/MS Graph) that mostly
 *   block on network I/O rather than local CPU, so a larger pool is safe/beneficial here.
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

    @Bean(name = "fileProcessingExecutor")
    public TaskExecutor fileProcessingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("eqms-fileproc-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "controlledCopyBatchExecutor")
    public TaskExecutor controlledCopyBatchExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("eqms-cc-batch-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "integrationExecutor")
    public TaskExecutor integrationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("eqms-integration-");
        executor.initialize();
        return executor;
    }
}
