package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * The weekly V2 verification (SDS 14.1, schedule "V2: Monday 05:00, weekly, on the latest backup"). It runs only in the restore worker,
 * the process that holds the key. It restores the latest backup that passed its last verification into a scratch database and runs
 * the rehearsal checks; the outcome is recorded as tier V2. If the previous weekly check is still waiting or running, this one is
 * skipped and the skip is written to the ledger (SKIPPED_OVERLAP).
 */
@Component
public class WeeklyV2Verification {

    private static final Logger log = LoggerFactory.getLogger(WeeklyV2Verification.class);
    /** The requester of a scheduled check; the rehearsal records its outcome as V2 when it finishes. */
    public static final String REQUESTER = "system:V2";

    private final JdbcTemplate jdbc;
    private final RestoreRehearsalService rehearsals;
    private final LedgerService ledger;
    private final AgentProperties properties;
    private final com.eqms.backup.agent.backup.BackupRepository repository;
    private final Clock clock;

    public WeeklyV2Verification(JdbcTemplate jdbc, RestoreRehearsalService rehearsals, LedgerService ledger, AgentProperties properties,
                                com.eqms.backup.agent.backup.BackupRepository repository, Clock clock) {
        this.jdbc = jdbc;
        this.rehearsals = rehearsals;
        this.ledger = ledger;
        this.properties = properties;
        this.repository = repository;
        this.clock = clock;
    }

    /** A weekly check is overdue when no V2 check was requested or completed in this many days (SDS 14.1, schedule). */
    static final int OVERDUE_DAYS = 8;

    /**
     * Catch-up (SDS 14.1, "a missed schedule runs once when the agent is back; the event MISSED raises a warning"). Runs every day in the
     * worker. When no weekly check was requested within the last week, it writes MISSED, raises a HIGH alert, and runs the check once.
     */
    @Scheduled(cron = "0 0 6 * * *", zone = "Asia/Ho_Chi_Minh")
    public void catchUp() {
        if (!properties.isRestoreWorker()) return;
        try {
            Instant lastRequest = lastInstant("select max(requested_at) from restore_rehearsal where requested_by = ?", REQUESTER);
            Instant lastVerified = lastInstant("select max(verified_at) from backup_verification where tier = 'V2' and result = 'VERIFIED'");
            Instant now = clock.instant();
            Instant cutoff = now.minus(Duration.ofDays(OVERDUE_DAYS));
            if (lastVerified == null || lastVerified.isBefore(cutoff)) {
                repository.insertAlert("HIGH", "BACKUP_V2_OVERDUE", "No V2 verification has passed in the last " + OVERDUE_DAYS + " days", null);
            }
            if (lastRequest == null || lastRequest.isBefore(now.minus(Duration.ofDays(7)))) {
                ledger.append("restore-worker", "MISSED", "maintenance", Map.of("check", "V2", "lastRequest", String.valueOf(lastRequest)));
                repository.insertAlert("HIGH", "BACKUP_V2_MISSED", "The weekly V2 verification did not run on schedule; it is run now, once", null);
                runOnce();
            }
        } catch (RuntimeException e) {
            log.error("The V2 catch-up check failed", e);
        }
    }

    private Instant lastInstant(String sql, Object... args) {
        java.sql.Timestamp ts = jdbc.queryForObject(sql, java.sql.Timestamp.class, args);
        return ts == null ? null : ts.toInstant();
    }

    @Scheduled(cron = "0 0 5 * * MON", zone = "Asia/Ho_Chi_Minh")
    public void weekly() {
        if (!properties.isRestoreWorker()) return;
        try {
            runOnce();
        } catch (RuntimeException e) {
            log.error("The weekly V2 verification could not be started", e);
        }
    }

    /** Queues one V2 check of the latest backup that passed its last verification. Returns the rehearsal id, or empty when skipped. */
    public Optional<String> runOnce() {
        Optional<String> backupId = jdbc.query("select r.backup_id from backup_run r where r.status = 'COMPLETED' "
                + "and (select v.result from backup_verification v where v.run_id = r.id order by v.verified_at desc limit 1) = 'VERIFIED' "
                + "order by r.started_at desc limit 1", (rs, i) -> rs.getString(1)).stream().findFirst();
        if (backupId.isEmpty()) {
            ledger.append("restore-worker", "V2_NO_CANDIDATE", "maintenance", Map.of());
            return Optional.empty();
        }
        Integer open = jdbc.queryForObject("select count(*) from restore_rehearsal where requested_by = ? and status in ('QUEUED', 'RUNNING')",
                Integer.class, REQUESTER);
        if (open != null && open > 0) {
            ledger.append("restore-worker", "SKIPPED_OVERLAP", backupId.get(), Map.of("check", "V2"));
            return Optional.empty();
        }
        try {
            String rehearsalId = String.valueOf(rehearsals.request(backupId.get(), REQUESTER, "Weekly V2 verification (SDS 14.1)").get("rehearsalId"));
            ledger.append("restore-worker", "V2_REQUESTED", backupId.get(), Map.of("rehearsalId", rehearsalId));
            return Optional.of(rehearsalId);
        } catch (ExportException e) {
            // another rehearsal is already waiting: the overlap rule applies
            ledger.append("restore-worker", "SKIPPED_OVERLAP", backupId.get(), Map.of("check", "V2", "reason", e.code));
            return Optional.empty();
        }
    }
}
