package com.eqms.service.report;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicBoolean;

/** Renewal is fenced by both attempt and live lease; an expired attempt cannot resurrect itself. */
@Service
public class ReportRunLeaseService {
    private final JdbcTemplate jdbc;
    private final TaskScheduler scheduler;

    public ReportRunLeaseService(JdbcTemplate jdbc, @Qualifier("jobLeaseScheduler") TaskScheduler scheduler) {
        this.jdbc = jdbc;
        this.scheduler = scheduler;
    }

    public RunLease maintain(UUID runId, int attempt) {
        RunLease lease = new RunLease();
        lease.task = scheduler.scheduleAtFixedRate(() -> {
            if (!lease.valid.get()) return;
            try {
                if (jdbc.update("""
                        update report_runs set lease_until=now()+interval '10 minutes'
                        where id=? and attempt_count=? and status='PROCESSING' and lease_until>now()
                        """, runId, attempt) != 1) lease.valid.set(false);
            } catch (RuntimeException unavailable) {
                lease.valid.set(false);
            }
        }, Instant.now().plusSeconds(60), Duration.ofSeconds(60));
        return lease;
    }

    public static final class RunLease implements AutoCloseable {
        private final AtomicBoolean valid = new AtomicBoolean(true);
        private ScheduledFuture<?> task;

        public void requireOwned() {
            if (!valid.get()) throw new IllegalStateException("REPORT_WORKER_LEASE_LOST");
        }

        @Override
        public void close() {
            valid.set(false);
            if (task != null) task.cancel(false);
        }
    }
}
