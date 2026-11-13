package com.eqms.backup.agent.watch;

import com.eqms.backup.agent.alert.AlertRuleService;
import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.copy.ManualCopyService;
import com.eqms.backup.agent.job.BackupScheduler;
import com.eqms.backup.agent.job.JobQueue;
import com.eqms.backup.agent.objects.StoreScrubService;
import com.eqms.backup.agent.target.FolderTarget;
import com.eqms.backup.agent.target.TargetCatalog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

/**
 * Looks, every ten minutes, for conditions that nobody would otherwise see: a backup that should have run and did not, a target that is
 * nearly full, a copy that a person has not made in time, a rebuild kit item that no one has checked for too long. Each one raises an alert
 * once while it lasts (an open alert of the same kind is not raised again). The limits are the ones of the alert rules.
 */
@Component
public class HealthWatch {

    private static final Logger log = LoggerFactory.getLogger(HealthWatch.class);

    private final JdbcTemplate jdbc;
    private final BackupRepository repository;
    private final BackupScheduler scheduler;
    private final AlertRuleService rules;
    private final TargetCatalog targets;
    private final ManualCopyService manualCopy;
    private final AgentProperties properties;
    private final JobQueue queue;
    private final StoreScrubService scrub;

    public HealthWatch(JdbcTemplate jdbc, BackupRepository repository, BackupScheduler scheduler, AlertRuleService rules, TargetCatalog targets,
                       ManualCopyService manualCopy, AgentProperties properties, JobQueue queue, StoreScrubService scrub) {
        this.queue = queue;
        this.scrub = scrub;
        this.jdbc = jdbc;
        this.repository = repository;
        this.scheduler = scheduler;
        this.rules = rules;
        this.targets = targets;
        this.manualCopy = manualCopy;
        this.properties = properties;
    }

    @Scheduled(fixedDelay = 600_000, initialDelay = 120_000)
    public void tick() {
        if (properties.isRestoreWorker()) return;
        check(Instant.now());
    }

    /** The weekly check of the file store (SDS-BR-004 2.4): Sunday 03:30, after the night's backup. It is queued like any other job. */
    @Scheduled(cron = "0 30 3 * * SUN", zone = "Asia/Ho_Chi_Minh")
    public void weeklyScrub() {
        if (properties.isRestoreWorker() || !scrub.enabled()) return;
        Integer open = jdbc.queryForObject("select count(*) from backup_job where job_type = 'SCRUB' and status in ('QUEUED','RUNNING')", Integer.class);
        if (open != null && open > 0) return;
        queue.enqueue("SCRUB", "{\"trigger\":\"SCHEDULED\"}", "system:scrub");
    }

    /** One pass over every condition; one that fails to be read does not stop the others. */
    public void check(Instant now) {
        run("backup missed", () -> missedBackup(now));
        run("capacity", this::capacity);
        run("manual copy", () -> overdueManualCopy(now));
        run("rebuild kit", () -> overdueKit(now));
        run("local storage", this::localStorageNotBackedUp);
    }

    private void run(String what, Runnable check) {
        try {
            check.run();
        } catch (RuntimeException e) {
            log.warn("The check for {} could not be made: {}", what, e.getMessage());
        }
    }

    void missedBackup(Instant now) {
        missedBackup(now, com.eqms.backup.agent.job.BackupScheduler.Part.DATABASE);
        missedBackup(now, com.eqms.backup.agent.job.BackupScheduler.Part.FILES);
    }

    /** A part is missed when no completed backup holding it has started since it was due, once the grace time has passed. */
    private void missedBackup(Instant now, com.eqms.backup.agent.job.BackupScheduler.Part part) {
        Optional<Instant> due = scheduler.lastDue(now, part);
        if (due.isEmpty()) return;
        int graceHours = rules.threshold("BACKUP_MISSED", 2);
        if (now.isBefore(due.get().plus(Duration.ofHours(graceHours)))) return;
        boolean files = part == com.eqms.backup.agent.job.BackupScheduler.Part.FILES;
        Integer done = jdbc.queryForObject("select count(*) from backup_run r where r.status = 'COMPLETED' and r.started_at >= ? and exists "
                + "(select 1 from backup_component_result c where c.run_id = r.id and c.component = ? and c.status = 'COMPLETED')", Integer.class,
                Timestamp.from(due.get()), files ? "OBJECT_STORE" : "DATABASE");
        if (done != null && done > 0) return;
        repository.insertAlertOnce("HIGH", "BACKUP_MISSED", "The " + (files ? "files backup" : "backup") + " due at " + due.get() + " has not completed " + graceHours + " hour(s) after its time. "
                + "Look at the Backup History for a failure, and at the Backup Agent.", (files ? "FILES:" : "") + due.get());
    }

    void capacity() {
        int limit = rules.threshold("CAPACITY_HIGH", 80);
        for (var target : targets.all()) {
            if (!(target instanceof FolderTarget folder)) continue;
            try {
                double used = folder.usedPercent();
                if (used >= limit) {
                    repository.insertAlertOnce("HIGH", "CAPACITY_HIGH", "Target " + folder.code() + " is " + Math.round(used) + "% full (limit " + limit + "%). Backups are kept permanently, so the space only grows.", folder.code());
                }
            } catch (java.io.IOException e) {
                log.warn("The size of target {} could not be read: {}", folder.code(), e.getMessage());
            }
        }
    }

    void overdueManualCopy(Instant now) {
        ZoneId zone = ZoneId.of(properties.getZone());
        var status = manualCopy.status(LocalDate.ofInstant(now, zone));
        if (!Boolean.TRUE.equals(status.get("declared"))) return;
        int grace = rules.threshold("MANUAL_COPY_OVERDUE", 1);
        String state = String.valueOf(status.get("state"));
        if ("NEVER_RECORDED".equals(state)) {
            // the policy promises a copy; nothing has been recorded since. Counted from when the policy that declared it began.
            Timestamp since = jdbc.queryForObject("select min(created_at) from backup_policy where targets_json -> 'manualCopy' ->> 'declared' = 'true'", Timestamp.class);
            Number every = (Number) status.get("everyDays");
            if (since != null && every != null && now.isAfter(since.toInstant().plus(Duration.ofDays(every.longValue() + grace)))) {
                repository.insertAlertOnce("HIGH", "MANUAL_COPY_OVERDUE", "The policy says a copy is made by hand every " + every + " day(s), but none has been recorded.", "NEVER");
            }
            return;
        }
        if ("OVERDUE".equals(state)) {
            LocalDate due = LocalDate.parse(String.valueOf(status.get("nextDueOn")));
            if (LocalDate.ofInstant(now, zone).isAfter(due.plusDays(grace))) {
                repository.insertAlertOnce("HIGH", "MANUAL_COPY_OVERDUE", "The manual copy was due on " + due + "; the last one recorded was made on " + status.get("lastCopiedOn") + ".", due.toString());
            }
        }
    }

    /**
     * The application writes files to a folder on its own disk when it is not using the document store. Nothing backs that folder up, so a file
     * found there is a file that has no copy: it is told, once while it lasts.
     */
    public void localStorageNotBackedUp() {
        java.nio.file.Path root = properties.getLocalStoragePath();
        if (root == null || !java.nio.file.Files.isDirectory(root)) return;
        long files = 0;
        long bytes = 0;
        String sample = null;
        try (java.util.stream.Stream<java.nio.file.Path> walk = java.nio.file.Files.walk(root)) {
            for (java.nio.file.Path p : (Iterable<java.nio.file.Path>) walk.filter(java.nio.file.Files::isRegularFile)::iterator) {
                files++;
                bytes += java.nio.file.Files.size(p);
                if (sample == null) sample = root.relativize(p).toString();
                if (files >= 100_000) break;
            }
        } catch (java.io.IOException e) {
            log.warn("The local storage folder could not be read: {}", e.getMessage());
            return;
        }
        if (files > 0) {
            repository.insertAlertOnce("HIGH", "LOCAL_STORAGE_NOT_BACKED_UP", files + " file(s), " + bytes + " bytes, are on the application's own disk (for example "
                    + sample + "). That folder is not backed up; move the files to the document store or add the folder to the backup.", "backend-storage");
        }
    }

    void overdueKit(Instant now) {
        int days = rules.threshold("DR_KIT_OVERDUE", 365);
        jdbc.queryForList("select i.code, i.label, max(v.verified_at) as last from rebuild_kit_item i left join rebuild_kit_verification v on v.item_code = i.code group by i.code, i.label").forEach(row -> {
            Timestamp last = (Timestamp) row.get("last");
            // an item nobody has ever checked is shown as "not verified" on the plan; it is only called overdue when it has been checked once and has gone stale
            if (last != null && last.toInstant().isBefore(now.minus(Duration.ofDays(days)))) {
                repository.insertAlertOnce("WARNING", "DR_KIT_OVERDUE", "Rebuild kit item \"" + row.get("label") + "\" was last checked on " + last.toInstant() + ", more than " + days + " days ago.", (String) row.get("code"));
            }
        });
    }
}
