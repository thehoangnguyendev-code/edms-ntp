package com.eqms.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * REPORT-BACKUP-RUNS-2026-11-15: copies the summary of every backup, verification, restore, rehearsal and store scrub from the backup control database into the application's
 * own database (table backup_run_summary), so that the Backup and Restore Runs report can read it. The control database stays the record and stays on its isolated network.
 * The application reads it with its own read-only login, which can read one view (reporting.run_summary: no error text, path, key or manifest) and nothing else; the login is made
 * by an operator (scripts/backup/report-reader-role.sh) and its password is the environment variable BACKUP_REPORT_DB_PASSWORD. With no password the copy is switched off.
 * A line is added or updated, never deleted: a run the control database has dropped stays in the copy. The connection is opened for one pass and closed; it is not a data source
 * of the application. The state of the last pass is kept in backup_run_summary_sync.
 */
@Service
public class BackupRunSummarySyncService {
    private static final Logger log = LoggerFactory.getLogger(BackupRunSummarySyncService.class);
    private static final int BATCH = 500;
    private static final String SELECT = "select kind, source_id, reference, backup_number, status, trigger_kind, run_type, environment, started_at, finished_at, actor, size_bytes, tier, error_code, "
            + "failed_step, restore_seconds, checked_files, different_files, missing_files, reason, change_control_ref from reporting.run_summary";
    private static final String UPSERT = """
            insert into backup_run_summary(kind, source_id, reference, backup_number, status, trigger_kind, run_type, environment, started_at, finished_at, actor, size_bytes, tier, error_code,
                failed_step, restore_seconds, checked_files, different_files, missing_files, reason, change_control_ref)
            values (?, cast(? as uuid), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (kind, source_id) do update set reference=excluded.reference, backup_number=excluded.backup_number, status=excluded.status, trigger_kind=excluded.trigger_kind,
                run_type=excluded.run_type, environment=excluded.environment, started_at=excluded.started_at, finished_at=excluded.finished_at, actor=excluded.actor, size_bytes=excluded.size_bytes,
                tier=excluded.tier, error_code=excluded.error_code, failed_step=excluded.failed_step, restore_seconds=excluded.restore_seconds, checked_files=excluded.checked_files,
                different_files=excluded.different_files, missing_files=excluded.missing_files, reason=excluded.reason, change_control_ref=excluded.change_control_ref, synced_at=now()
            where (backup_run_summary.status, backup_run_summary.finished_at, backup_run_summary.size_bytes, backup_run_summary.error_code, backup_run_summary.failed_step,
                   backup_run_summary.restore_seconds, backup_run_summary.checked_files, backup_run_summary.different_files, backup_run_summary.missing_files, backup_run_summary.reason)
                is distinct from (excluded.status, excluded.finished_at, excluded.size_bytes, excluded.error_code, excluded.failed_step,
                   excluded.restore_seconds, excluded.checked_files, excluded.different_files, excluded.missing_files, excluded.reason)
            """;

    private final JdbcTemplate jdbc;
    private final DistributedSchedulerLockService lockService;
    private final BackupAgentClient agent;
    private final String url;
    private final String user;
    private final String password;

    public BackupRunSummarySyncService(JdbcTemplate jdbc, DistributedSchedulerLockService lockService, BackupAgentClient agent,
                                       @Value("${app.backup-report.url:jdbc:postgresql://backup-control:5432/eqms_backup_control}") String url,
                                       @Value("${app.backup-report.user:eqms_backup_report_ro}") String user,
                                       @Value("${app.backup-report.password:}") String password) {
        this.jdbc = jdbc;
        this.lockService = lockService;
        this.agent = agent;
        this.url = url;
        this.user = user;
        this.password = password;
    }

    /** Whether the copy is switched on (a password is set). */
    public boolean enabled() {
        return password != null && !password.isBlank();
    }

    /** The copy is out of date when it has not been refreshed for this long. */
    public static final int STALE_AFTER_MINUTES = 30;

    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    public void scheduled() {
        if (!enabled()) return;
        try (var lease = lockService.tryAcquire("backup-run-summary-sync", Duration.ofMinutes(5))) {
            if (!lease.acquired()) return;
            sync();
            raiseAlertIfStale();
        } catch (Exception e) {
            log.debug("The backup run summary was not copied this time: {}", e.getMessage());
        }
    }

    /** What the screens and the alert need to know about the copy: whether it is on, when it was last refreshed, how it ended and whether it is out of date. */
    public Map<String, Object> status() {
        Map<String, Object> row = jdbc.queryForMap("select last_attempt_at, last_success_at, last_rows, last_error, "
                + "(last_success_at is null or last_success_at < now() - make_interval(mins => ?)) as behind from backup_run_summary_sync where id=1", STALE_AFTER_MINUTES);
        boolean on = enabled();
        // A copy that is on, was tried at least once and has no success in STALE_AFTER_MINUTES is out of date; one that was never tried yet (just started) is not.
        boolean stale = on && row.get("last_attempt_at") != null && Boolean.TRUE.equals(row.get("behind"));
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("enabled", on);
        status.put("lastAttemptAt", row.get("last_attempt_at") == null ? null : String.valueOf(row.get("last_attempt_at")));
        status.put("lastSuccessAt", row.get("last_success_at") == null ? null : String.valueOf(row.get("last_success_at")));
        status.put("lastRows", row.get("last_rows"));
        status.put("lastError", row.get("last_error"));
        status.put("stale", stale);
        status.put("staleAfterMinutes", STALE_AFTER_MINUTES);
        return status;
    }

    /** Tells the agent when the copy is out of date; the agent raises one alert (and keeps it until it is acknowledged) and tells the people of its alert rules. */
    void raiseAlertIfStale() {
        Map<String, Object> status = status();
        if (!Boolean.TRUE.equals(status.get("stale"))) return;
        String detail = "The copy of the backup and restore runs for the report was last refreshed " + (status.get("lastSuccessAt") == null ? "never" : String.valueOf(status.get("lastSuccessAt")))
                + (status.get("lastError") == null ? "" : "; last problem: " + status.get("lastError"));
        try {
            agent.exchange(org.springframework.http.HttpMethod.POST, "/internal/alerts/external", Map.of("code", "REPORT_COPY_STALE", "severity", "WARNING", "detail", detail));
        } catch (RuntimeException e) {
            log.debug("The agent could not be told that the report copy is out of date: {}", e.getMessage());
        }
    }

    /** One pass; returns the number of lines read, or -1 when the copy is switched off or the pass failed (the reason is kept in backup_run_summary_sync). */
    public int sync() {
        if (!enabled()) return -1;
        jdbc.update("update backup_run_summary_sync set last_attempt_at=now() where id=1");
        Properties props = new Properties();
        props.setProperty("user", user);
        props.setProperty("password", password);
        props.setProperty("connectTimeout", "5");
        props.setProperty("socketTimeout", "60");
        props.setProperty("ApplicationName", "eqms-backend-backup-report");
        int read = 0;
        try (Connection c = DriverManager.getConnection(url, props)) {
            c.setReadOnly(true);
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                st.setFetchSize(BATCH);
                try (ResultSet rs = st.executeQuery(SELECT)) {
                    List<Object[]> batch = new ArrayList<>(BATCH);
                    while (rs.next()) {
                        batch.add(new Object[]{rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8),
                                rs.getObject(9, OffsetDateTime.class), rs.getObject(10, OffsetDateTime.class), rs.getString(11), rs.getObject(12, Long.class), rs.getString(13), rs.getString(14),
                                rs.getString(15), rs.getObject(16, Integer.class), rs.getObject(17, Long.class), rs.getObject(18, Integer.class), rs.getObject(19, Integer.class),
                                rs.getString(20), rs.getString(21)});
                        read++;
                        if (batch.size() >= BATCH) {
                            jdbc.batchUpdate(UPSERT, batch);
                            batch.clear();
                        }
                    }
                    if (!batch.isEmpty()) jdbc.batchUpdate(UPSERT, batch);
                }
            }
            c.rollback();
            jdbc.update("update backup_run_summary_sync set last_success_at=now(), last_rows=?, last_error=null where id=1", read);
            return read;
        } catch (Exception e) {
            String reason = (e.getClass().getSimpleName() + ": " + String.valueOf(e.getMessage()).replaceAll("\\s+", " "));
            jdbc.update("update backup_run_summary_sync set last_error=? where id=1", reason.length() > 300 ? reason.substring(0, 300) : reason);
            log.warn("The backup run summary could not be copied: {}", e.getClass().getSimpleName());
            return -1;
        }
    }
}
