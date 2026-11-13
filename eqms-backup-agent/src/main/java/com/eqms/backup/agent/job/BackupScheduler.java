package com.eqms.backup.agent.job;

import com.eqms.backup.agent.config.AgentProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;

/**
 * Turns the active policy into jobs. Once a minute it asks one question: "has the backup that was due most recently been
 * started?" If not, it queues exactly one. That also covers a backup missed because the agent was down: it runs once when the
 * agent returns, never several times (SDS section 15.2).
 */
@Component
public class BackupScheduler {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final JobQueue queue;
    private final AgentProperties properties;
    private final com.eqms.backup.agent.maintenance.MaintenanceService maintenance;

    public BackupScheduler(JdbcTemplate jdbc, JobQueue queue, AgentProperties properties, com.eqms.backup.agent.maintenance.MaintenanceService maintenance) {
        this.jdbc = jdbc;
        this.queue = queue;
        this.properties = properties;
        this.maintenance = maintenance;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void tick() {
        if (properties.isRestoreWorker()) return;
        tick(Instant.now());
    }

    public void tick(Instant now) {
        // SDS 11.1: the scheduler stays off while users are being drained or the system is locked for a restore
        if (maintenance.status().state() != com.eqms.backup.agent.maintenance.MaintenanceService.State.NORMAL) return;
        boolean separate = filesHaveOwnSchedule();
        for (Part part : Part.values()) {
            Optional<Instant> due = lastDue(now, part);
            if (due.isEmpty()) continue;
            if (queue.hasOpenBackupJob()) return;
            if (alreadyQueued(part, due.get(), separate)) continue;
            String components = separate ? ",\"components\":[\"" + (part == Part.FILES ? "OBJECT_STORE" : "DATABASE") + "\"]" : "";
            String reason = part == Part.FILES ? "Files scheduled by the active policy" : "Scheduled by the active policy";
            queue.enqueue("BACKUP_DB", "{\"type\":\"FULL\",\"trigger\":\"SCHEDULED\",\"schedule\":\"" + part.name() + "\"" + components + ",\"reason\":\"" + reason + "\"}", "scheduler");
            return; // one job at a time; the other part is picked up on the next tick
        }
    }

    /** The two things a policy can schedule. Unless the files have a schedule of their own they are part of the database run. */
    public enum Part { DATABASE, FILES }

    private boolean alreadyQueued(Part part, Instant due, boolean separate) {
        Integer jobs = jdbc.queryForObject("select count(*) from backup_job where job_type = 'BACKUP_DB' and payload_json->>'trigger' = 'SCHEDULED' "
                + "and coalesce(payload_json->>'schedule', 'DATABASE') = ? and created_at >= ?", Integer.class, part.name(), Timestamp.from(due));
        if (jobs != null && jobs > 0) return true;
        // a scheduled run that holds the part already counts, including one made before the files had a time of their own
        Integer runs = separate
                ? jdbc.queryForObject("select count(*) from backup_run r where r.trigger_kind = 'SCHEDULED' and r.started_at >= ? and exists "
                        + "(select 1 from backup_component_result c where c.run_id = r.id and c.component = ?)", Integer.class, Timestamp.from(due), part == Part.FILES ? "OBJECT_STORE" : "DATABASE")
                : jdbc.queryForObject("select count(*) from backup_run where trigger_kind = 'SCHEDULED' and started_at >= ?", Integer.class, Timestamp.from(due));
        return runs != null && runs > 0;
    }

    /** True when the active policy gives the files their own time instead of backing them up with the database. */
    public boolean filesHaveOwnSchedule() {
        return files().isPresent();
    }

    private Optional<JsonNode> files() {
        var row = jdbc.queryForList("select schedule_json::text as schedule, scope_json::text as scope from backup_policy where status = 'ACTIVE'").stream().findFirst();
        if (row.isEmpty()) return Optional.empty();
        try {
            JsonNode files = JSON.readTree((String) row.get().get("schedule")).path("files");
            boolean inScope = false;
            for (JsonNode c : JSON.readTree((String) row.get().get("scope")).path("components")) inScope |= "OBJECT_STORE".equals(c.asText());
            return files.path("enabled").asBoolean(false) && inScope ? Optional.of(files) : Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** The most recent moment, not after {@code now}, at which the database backup was due. */
    public Optional<Instant> lastDue(Instant now) {
        return lastDue(now, Part.DATABASE);
    }

    /** The most recent moment, not after {@code now}, at which the given part was due. The files are only due on their own when they have a schedule. */
    public Optional<Instant> lastDue(Instant now, Part part) {
        Optional<String> schedule = jdbc.queryForList("select schedule_json::text from backup_policy where status = 'ACTIVE'", String.class).stream().findFirst();
        if (schedule.isEmpty()) return Optional.empty();
        try {
            JsonNode db = part == Part.FILES ? files().orElse(null) : JSON.readTree(schedule.get()).path("database");
            if (db == null) return Optional.empty();
            if (!db.path("enabled").asBoolean(false) || !"DAILY".equals(db.path("frequency").asText())) return Optional.empty();
            LocalTime time = LocalTime.parse(db.path("time").asText("02:00"));
            ZoneId zone = ZoneId.of(properties.getZone());
            ZonedDateTime today = now.atZone(zone).toLocalDate().atTime(time).atZone(zone);
            ZonedDateTime due = today.toInstant().isAfter(now) ? today.minusDays(1) : today;
            return Optional.of(due.toInstant());
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
