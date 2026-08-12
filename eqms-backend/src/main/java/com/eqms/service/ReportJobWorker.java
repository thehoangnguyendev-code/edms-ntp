package com.eqms.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Duration;

/** DB-backed report queue consumer. Redis unavailability deliberately skips work to avoid duplicate regulated artifacts. */
@Service
public class ReportJobWorker {
    private final ReportPlatformService reports; private final DistributedSchedulerLockService locks;
    public ReportJobWorker(ReportPlatformService reports, DistributedSchedulerLockService locks) { this.reports=reports; this.locks=locks; }
    @Scheduled(fixedDelayString="${app.reports.worker-delay-ms:1500}")
    public void consume() {
        try (var lease=locks.tryAcquire("report-platform-worker", Duration.ofMinutes(2))) {
            if (!lease.acquired()) return;
            reports.recoverExpiredLeases();
            reports.purgeExpiredArtifacts();
            for (int i=0;i<4 && reports.processOneDueSchedule();i++) { /* bounded schedule batch */ }
            for (int i=0;i<4 && reports.processOneQueuedRun();i++) { /* bounded worker batch */ }
        }
    }
}
