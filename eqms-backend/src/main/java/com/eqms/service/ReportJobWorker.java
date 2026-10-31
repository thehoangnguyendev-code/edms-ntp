package com.eqms.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.TaskScheduler;

/** DB-backed report queue consumer. Redis unavailability deliberately skips work to avoid duplicate regulated artifacts. */
@Service
public class ReportJobWorker {
    private static final Duration LEASE_TTL = Duration.ofMinutes(2);
    private final ReportPlatformService reports;
    private final DistributedSchedulerLockService locks;
    private final TaskExecutor executor;
    private final TaskScheduler heartbeat;
    private final AtomicBoolean running = new AtomicBoolean();

    public ReportJobWorker(ReportPlatformService reports, DistributedSchedulerLockService locks,
            @Qualifier("reportWorkerExecutor") TaskExecutor executor,
            @Qualifier("jobLeaseScheduler") TaskScheduler heartbeat) {
        this.reports = reports;
        this.locks = locks;
        this.executor = executor;
        this.heartbeat = heartbeat;
    }
    @Scheduled(fixedDelayString="${app.reports.worker-delay-ms:1500}")
    public void consume() {
        if (!running.compareAndSet(false, true)) return;
        try {
            executor.execute(() -> {
                try { consumeBatch(); }
                finally { running.set(false); }
            });
        } catch (RuntimeException rejected) {
            running.set(false);
            throw rejected; // Nothing claimed; next scheduled tick can retry.
        }
    }

    private void consumeBatch() {
        try (var lease=locks.tryAcquire("report-platform-worker", LEASE_TTL)) {
            if (!lease.acquired()) return;
            var renewal = heartbeat.scheduleAtFixedRate(() -> lease.renew(LEASE_TTL),
                    Instant.now().plusSeconds(30), Duration.ofSeconds(30));
            try {
                reports.recoverExpiredLeases();
                if (!lease.acquired()) return;
                reports.purgeExpiredArtifacts();
                for (int i=0;i<4 && lease.acquired() && reports.processOneDueSchedule();i++) { }
                for (int i=0;i<4 && lease.acquired() && reports.processOneQueuedRun();i++) { }
            } finally {
                if (renewal != null) renewal.cancel(false);
            }
        }
    }
}
