package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

import java.time.Instant;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Captures successful object-storage scans. A scan failure does not create a snapshot.
 * The single worker prevents scans from blocking Spring's shared scheduler.
 */
@Service
public class StorageUsageSnapshotService {
    private static final Logger log = LoggerFactory.getLogger(StorageUsageSnapshotService.class);
    private static final long SCAN_LOCK = 0x45514d53544f5245L;
    private final MinioObjectStorageService storage;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "storage-usage-sampler");
        thread.setDaemon(true);
        return thread;
    });
    private final AtomicBoolean running = new AtomicBoolean();
    @Value("${app.storage-usage.interval-ms:3600000}")
    private long intervalMs = 3600000;
    /** Tells the administrators when the usage reaches the warning threshold; optional so that a measurement never depends on it. */
    private StorageUsageAlertService alerts;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setAlerts(StorageUsageAlertService alerts) {
        this.alerts = alerts;
    }

    public record Snapshot(Instant measuredAt, long totalBytes, long objectVersions,
                           JsonNode byDomain, JsonNode byFileType) {}
    public record ScanState(Instant lastAttemptAt, Instant lastSuccessAt, String lastResult, boolean stale) {}

    public StorageUsageSnapshotService(MinioObjectStorageService storage, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.storage = storage;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Scheduled(fixedDelayString = "${app.storage-usage.interval-ms:3600000}",
            initialDelayString = "${app.storage-usage.initial-delay-ms:60000}")
    public void scheduleSample() {
        if (!running.compareAndSet(false, true)) return;
        worker.execute(() -> {
            try {
                sample();
            } catch (Exception ex) {
                // Object keys, connection details and credentials must not enter application logs.
                log.warn("Storage usage scan failed; no snapshot was saved");
            } finally {
                running.set(false);
            }
        });
    }

    void sample() throws Exception {
        // Hold the advisory lock on this very connection until the scan finishes, including
        // persistence. A second application instance skips instead of starting another scan.
        try (Connection connection = java.util.Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            connection.setAutoCommit(true);
            try (var lock = connection.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
                lock.setLong(1, SCAN_LOCK);
                try (var result = lock.executeQuery()) {
                    if (!result.next() || !result.getBoolean(1)) return;
                }
            }
            try {
                var usage = storage.measureObjectUsage();
                connection.setAutoCommit(false);
                try (var insert = connection.prepareStatement("INSERT INTO storage_usage_snapshot(total_bytes,object_versions,by_domain,by_file_type) VALUES (?,?,CAST(? AS jsonb),CAST(? AS jsonb))");
                     var status = connection.prepareStatement("UPDATE storage_usage_scan_state SET last_attempt_at=now(),last_success_at=now(),last_result='SUCCESS' WHERE id=true")) {
                    insert.setLong(1, usage.bytes());
                    insert.setLong(2, usage.objects());
                    insert.setString(3, mapper.writeValueAsString(usage.byModule()));
                    insert.setString(4, mapper.writeValueAsString(usage.byFileType()));
                    insert.executeUpdate();
                    status.executeUpdate();
                    connection.commit();
                    connection.setAutoCommit(true);
                }
                if (alerts != null) alerts.afterSuccessfulScan(usage.bytes());
            } catch (Exception ex) {
                if (!connection.getAutoCommit()) connection.rollback();
                connection.setAutoCommit(true);
                try (var status = connection.prepareStatement("UPDATE storage_usage_scan_state SET last_attempt_at=now(),last_result='FAILED' WHERE id=true")) {
                    status.executeUpdate();
                } catch (SQLException statusFailure) {
                    ex.addSuppressed(statusFailure);
                }
                throw ex;
            } finally {
                try (var unlock = connection.prepareStatement("SELECT pg_advisory_unlock(?)")) {
                    unlock.setLong(1, SCAN_LOCK);
                    unlock.execute();
                }
            }
        }
    }

    public ScanState scanState() {
        return jdbc.queryForObject("SELECT last_attempt_at,last_success_at,last_result FROM storage_usage_scan_state WHERE id=true",
                (rs, row) -> {
                    Instant attempt = rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant();
                    Instant success = rs.getTimestamp(2) == null ? null : rs.getTimestamp(2).toInstant();
                    long maxAge = intervalMs <= 0 ? 7200000 : intervalMs > Long.MAX_VALUE / 2 ? Long.MAX_VALUE : intervalMs * 2;
                    boolean stale = success == null || java.time.Duration.between(success, Instant.now()).toMillis() > maxAge;
                    return new ScanState(attempt, success, rs.getString(3), stale);
                });
    }

    /** The history is bounded server-side to keep response and database work predictable. */
    public List<Snapshot> history() {
        return jdbc.query("SELECT measured_at,total_bytes,object_versions,by_domain::text,by_file_type::text FROM storage_usage_snapshot WHERE measured_at >= now() - interval '90 days' ORDER BY measured_at DESC LIMIT 2160",
                (rs, row) -> new Snapshot(rs.getTimestamp(1).toInstant(), rs.getLong(2), rs.getLong(3), parse(rs.getString(4)), parse(rs.getString(5))));
    }

    private JsonNode parse(String json) {
        try { return mapper.readTree(json); }
        catch (Exception ex) { throw new IllegalStateException("Invalid stored storage-usage data", ex); }
    }

    @PreDestroy
    public void shutdown() { worker.shutdown(); }
}
