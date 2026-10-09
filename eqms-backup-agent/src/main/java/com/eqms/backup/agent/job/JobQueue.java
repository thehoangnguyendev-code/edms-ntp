package com.eqms.backup.agent.job;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** The work the eQMS backend asks the agent to do. The backend only inserts rows; the agent claims and runs them. */
@Repository
public class JobQueue {

    public record Job(UUID id, String type, String payloadJson, String requestedBy) {
    }

    private final JdbcTemplate jdbc;

    public JobQueue(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public UUID enqueue(String type, String payloadJson, String requestedBy) {
        return jdbc.queryForObject("insert into backup_job(job_type, payload_json, requested_by) values (?, ?::jsonb, ?) returning id",
                UUID.class, type, payloadJson, requestedBy);
    }

    /** Takes the oldest queued job, or a job whose lease ran out because the agent died while running it. */
    public Optional<Job> claimNext(int leaseMinutes) {
        List<Job> claimed = jdbc.query(
                "update backup_job set status='RUNNING', attempts = attempts + 1, lease_until = now() + (? * interval '1 minute') "
                        + "where id = (select id from backup_job where status = 'QUEUED' or (status = 'RUNNING' and lease_until < now()) "
                        + "order by created_at limit 1 for update skip locked) returning id, job_type, payload_json::text, requested_by",
                (rs, i) -> new Job(rs.getObject("id", UUID.class), rs.getString("job_type"), rs.getString(3), rs.getString("requested_by")), leaseMinutes);
        return claimed.stream().findFirst();
    }

    public void finish(UUID id, boolean ok, String resultJson) {
        jdbc.update("update backup_job set status = ?, finished_at = now(), result_json = ?::jsonb where id = ?", ok ? "DONE" : "FAILED", resultJson, id);
    }

    public Optional<Map<String, Object>> find(UUID id) {
        return jdbc.queryForList("select id, job_type, status, attempts, requested_by, created_at, finished_at, result_json::text as result_json from backup_job where id = ?", id)
                .stream().findFirst();
    }

    public boolean hasOpenBackupJob() {
        Integer n = jdbc.queryForObject("select count(*) from backup_job where job_type = 'BACKUP_DB' and status in ('QUEUED','RUNNING')", Integer.class);
        return n != null && n > 0;
    }
}
