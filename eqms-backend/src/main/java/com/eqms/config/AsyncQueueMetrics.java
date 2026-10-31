package com.eqms.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/** Cached, low-cardinality queue measurements; scraping metrics never scans a business table. */
@Component
public class AsyncQueueMetrics implements MeterBinder {
    private final JdbcTemplate jdbc;
    private final AtomicLong available=new AtomicLong();
    private final List<Queue> queues=List.of(
            new Queue("publishing","publishing_workspace_jobs","created_at","status='QUEUED'"),
            new Queue("email","notification_email_outbox","created_at","status='PENDING'"),
            new Queue("email_uncertain","notification_email_outbox","claimed_at","status='UNKNOWN'"),
            new Queue("report","report_runs","queued_at","status in ('QUEUED','RETRY_SCHEDULED')"));

    public AsyncQueueMetrics(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @Override public void bindTo(MeterRegistry registry) {
        Gauge.builder("eqms.async.queue.sample.available",available,AtomicLong::get).register(registry);
        for(var queue:queues) {
            Gauge.builder("eqms.async.queue.size",queue.size,AtomicLong::get).tag("queue",queue.name).register(registry);
            Gauge.builder("eqms.async.queue.oldest.seconds",queue.age,AtomicLong::get).tag("queue",queue.name).register(registry);
        }
    }

    @Scheduled(fixedDelayString="${app.metrics.queue-sample-delay-ms:30000}")
    public void sample() {
        try {
            for(var queue:queues) {
                // SQL identifiers/conditions are fixed server constants, never request values.
                var row=jdbc.queryForMap("select count(*) as size,coalesce(extract(epoch from now()-min("+queue.timestamp+")),0) as age from "+queue.table+" where "+queue.condition);
                queue.size.set(((Number)row.get("size")).longValue());
                queue.age.set(Math.max(0,((Number)row.get("age")).longValue()));
            }
            available.set(1);
        } catch(RuntimeException unavailable) {available.set(0);}
    }

    private static final class Queue {
        final String name,table,timestamp,condition;
        final AtomicLong size=new AtomicLong(),age=new AtomicLong();
        Queue(String name,String table,String timestamp,String condition) {
            this.name=name;this.table=table;this.timestamp=timestamp;this.condition=condition;
        }
    }
}
