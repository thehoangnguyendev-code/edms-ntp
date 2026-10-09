package com.eqms.backup.agent;

import com.eqms.backup.agent.api.AgentTokenFilter;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.job.BackupScheduler;
import com.eqms.backup.agent.job.JobQueue;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class SchedulerQueueAndTokenTest {

    ControlDbTestSupport db;
    JobQueue queue;
    AgentProperties properties;
    BackupScheduler scheduler;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        queue = new JobQueue(db.jdbc);
        properties = new AgentProperties();
        properties.setZone("Asia/Ho_Chi_Minh");
        scheduler = new BackupScheduler(db.jdbc, queue, properties);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private static Instant at(String local) {
        return ZonedDateTime.parse(local + "[Asia/Ho_Chi_Minh]").toInstant();
    }

    @Test
    void theMostRecentDueMomentIsTodayAfterTheScheduledTimeAndYesterdayBefore() {
        // the seeded policy is daily at 02:00
        assertThat(scheduler.lastDue(at("2026-10-08T10:00:00+07:00"))).contains(at("2026-10-08T02:00:00+07:00"));
        assertThat(scheduler.lastDue(at("2026-10-08T01:00:00+07:00"))).contains(at("2026-10-07T02:00:00+07:00"));
        assertThat(scheduler.lastDue(at("2026-10-08T02:00:00+07:00"))).contains(at("2026-10-08T02:00:00+07:00"));
    }

    @Test
    void aDueBackupIsQueuedExactlyOnce() {
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        scheduler.tick(at("2026-10-08T10:01:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job where job_type='BACKUP_DB'", Integer.class)).isEqualTo(1);
        assertThat(db.jdbc.queryForObject("select requested_by from backup_job", String.class)).isEqualTo("scheduler");
    }

    @Test
    void aBackupAlreadyStartedForThatMomentIsNotQueuedAgain() {
        db.jdbc.update("insert into backup_run(backup_id, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-x', 'DEV', 'FULL', 'SCHEDULED', 'COMPLETED', ?, 'scheduler')", java.sql.Timestamp.from(at("2026-10-08T02:00:30+07:00")));
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isZero();
    }

    @Test
    void aMissedBackupRunsOnceWhenTheAgentReturnsNotOncePerMissedDay() {
        // last scheduled run was three days ago; the agent has been down since
        db.jdbc.update("insert into backup_run(backup_id, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-old', 'DEV', 'FULL', 'SCHEDULED', 'COMPLETED', ?, 'scheduler')", java.sql.Timestamp.from(at("2026-10-05T02:00:30+07:00")));
        scheduler.tick(at("2026-10-08T09:00:00+07:00"));
        scheduler.tick(at("2026-10-08T09:01:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isEqualTo(1);
    }

    @Test
    void aDisabledScheduleQueuesNothing() {
        db.jdbc.update("update backup_policy set schedule_json = '{\"database\":{\"enabled\":false,\"frequency\":\"DAILY\",\"time\":\"02:00\"}}'::jsonb");
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isZero();
    }

    @Test
    void jobsAreClaimedOldestFirstAndOnlyOnce() {
        queue.enqueue("VERIFY", "{\"backupId\":\"a\"}", "u1");
        queue.enqueue("VERIFY", "{\"backupId\":\"b\"}", "u2");
        Optional<JobQueue.Job> first = queue.claimNext(5);
        Optional<JobQueue.Job> second = queue.claimNext(5);
        assertThat(first).isPresent();
        assertThat(first.get().requestedBy()).isEqualTo("u1");
        assertThat(second.get().requestedBy()).isEqualTo("u2");
        assertThat(queue.claimNext(5)).isEmpty();
    }

    @Test
    void aJobWhoseLeaseRanOutBecauseTheAgentDiedIsGivenToTheNextClaim() {
        java.util.UUID id = queue.enqueue("VERIFY", "{\"backupId\":\"a\"}", "u1");
        assertThat(queue.claimNext(5)).isPresent();
        db.jdbc.update("update backup_job set lease_until = now() - interval '1 minute' where id = ?", id);
        Optional<JobQueue.Job> again = queue.claimNext(5);
        assertThat(again).isPresent();
        assertThat(again.get().id()).isEqualTo(id);
        assertThat(db.jdbc.queryForObject("select attempts from backup_job where id = ?", Integer.class, id)).isEqualTo(2);
    }

    @Test
    void aFinishedJobIsNotClaimedAgain() {
        java.util.UUID id = queue.enqueue("VERIFY", "{}", "u1");
        queue.claimNext(5);
        queue.finish(id, true, "{\"ok\":true}");
        assertThat(queue.claimNext(5)).isEmpty();
        assertThat(db.jdbc.queryForObject("select status from backup_job where id = ?", String.class, id)).isEqualTo("DONE");
    }

    // ----- the shared secret

    private int call(String configured, String presented, String path) throws Exception {
        AgentProperties p = new AgentProperties();
        p.setApiToken(configured);
        AgentTokenFilter filter = new AgentTokenFilter(p);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRequestURI(path);
        if (presented != null) request.addHeader("X-Agent-Token", presented);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void theInternalApiNeedsTheSharedSecret() throws Exception {
        String secret = "0123456789abcdef-secret";
        assertThat(call(secret, secret, "/internal/backups")).isEqualTo(200);
        assertThat(call(secret, "wrong-secret-value-xyz", "/internal/backups")).isEqualTo(401);
        assertThat(call(secret, null, "/internal/backups")).isEqualTo(401);
    }

    @Test
    void withoutAConfiguredSecretEveryCallIsRefused() throws Exception {
        assertThat(call("", "", "/internal/backups")).isEqualTo(401);
        assertThat(call("short", "short", "/internal/backups")).isEqualTo(401);
    }

    @Test
    void healthChecksDoNotNeedTheSecret() throws Exception {
        assertThat(call("", null, "/actuator/health")).isEqualTo(200);
    }

    @Test
    void zoneOfTheMomentsUsedInTheTestsIsAsExpected() {
        assertThat(ZoneId.of("Asia/Ho_Chi_Minh").getRules().getOffset(Instant.now()).getTotalSeconds()).isEqualTo(7 * 3600);
    }
}
