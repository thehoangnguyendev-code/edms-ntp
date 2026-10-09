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

    public BackupScheduler(JdbcTemplate jdbc, JobQueue queue, AgentProperties properties) {
        this.jdbc = jdbc;
        this.queue = queue;
        this.properties = properties;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void tick() {
        tick(Instant.now());
    }

    public void tick(Instant now) {
        Optional<Instant> due = lastDue(now);
        if (due.isEmpty() || queue.hasOpenBackupJob()) return;
        Integer already = jdbc.queryForObject(
                "select count(*) from backup_run where trigger_kind = 'SCHEDULED' and started_at >= ?", Integer.class, Timestamp.from(due.get()));
        if (already != null && already > 0) return;
        queue.enqueue("BACKUP_DB", "{\"type\":\"FULL\",\"trigger\":\"SCHEDULED\",\"reason\":\"Scheduled by the active policy\"}", "scheduler");
    }

    /** The most recent moment, not after {@code now}, at which the database backup was due. */
    public Optional<Instant> lastDue(Instant now) {
        Optional<String> schedule = jdbc.queryForList("select schedule_json::text from backup_policy where status = 'ACTIVE'", String.class).stream().findFirst();
        if (schedule.isEmpty()) return Optional.empty();
        try {
            JsonNode db = JSON.readTree(schedule.get()).path("database");
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
