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
        properties.setLedgerDir(java.nio.file.Files.createTempDirectory("ledger-test"));
        var ledger = new com.eqms.backup.agent.ledger.LedgerService(db.jdbc, db.tx, properties);
        var maintenance = new com.eqms.backup.agent.maintenance.MaintenanceService(db.jdbc, db.tx, ledger, properties);
        scheduler = new BackupScheduler(db.jdbc, queue, properties, maintenance);
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
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-x', 'DEV', 'FULL', 'SCHEDULED', 'COMPLETED', ?, 'scheduler')", java.sql.Timestamp.from(at("2026-10-08T02:00:30+07:00")));
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isZero();
    }

    @Test
    void aMissedBackupRunsOnceWhenTheAgentReturnsNotOncePerMissedDay() {
        // last scheduled run was three days ago; the agent has been down since
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
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

    private void filesOnTheirOwnSchedule(String scope) {
        db.jdbc.update("update backup_policy set scope_json = ?::jsonb, schedule_json = "
                + "'{\"database\":{\"enabled\":true,\"frequency\":\"DAILY\",\"time\":\"02:00\"},\"files\":{\"enabled\":true,\"frequency\":\"DAILY\",\"time\":\"03:00\"}}'::jsonb", scope);
    }

    private String next() {
        var job = queue.claimNext(5, java.util.List.of("BACKUP_DB")).orElseThrow();
        queue.finish(job.id(), true, "{}");
        return job.payloadJson().replace(": ", ":");
    }

    @Test
    void filesWithATimeOfTheirOwnAreBackedUpInTheirOwnRunAndTheDatabaseRunHoldsOnlyTheDatabase() {
        filesOnTheirOwnSchedule("{\"components\":[\"DATABASE\",\"OBJECT_STORE\"]}");
        assertThat(scheduler.filesHaveOwnSchedule()).isTrue();
        assertThat(scheduler.lastDue(at("2026-10-08T10:00:00+07:00"), BackupScheduler.Part.FILES)).contains(at("2026-10-08T03:00:00+07:00"));
        assertThat(scheduler.lastDue(at("2026-10-08T02:30:00+07:00"), BackupScheduler.Part.FILES)).contains(at("2026-10-07T03:00:00+07:00"));

        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        scheduler.tick(at("2026-10-08T10:00:30+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).as("one job at a time").isEqualTo(1);
        assertThat(next()).contains("\"schedule\":\"DATABASE\"").contains("\"components\":[\"DATABASE\"]");

        scheduler.tick(at("2026-10-08T10:01:00+07:00"));
        assertThat(next()).contains("\"schedule\":\"FILES\"").contains("\"components\":[\"OBJECT_STORE\"]");

        scheduler.tick(at("2026-10-08T10:02:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).as("each part once").isEqualTo(2);
    }

    @Test
    void anEarlierScheduledRunThatHoldsAPartCountsForItWhenTheFilesGetATimeOfTheirOwn() {
        filesOnTheirOwnSchedule("{\"components\":[\"DATABASE\",\"OBJECT_STORE\"]}");
        // the 02:00 run held both parts: the database is covered for today, the files (due at 03:00) are not
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-both', 'DEV', 'FULL', 'SCHEDULED', 'COMPLETED', ?, 'scheduler')", java.sql.Timestamp.from(at("2026-10-08T02:00:30+07:00")));
        db.jdbc.update("insert into backup_component_result(run_id, component, status) select id, c, 'COMPLETED' from backup_run, unnest(array['DATABASE','OBJECT_STORE']) c where backup_number = 'BK-both'");
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        assertThat(next()).contains("\"schedule\":\"FILES\"");
        scheduler.tick(at("2026-10-08T10:01:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isEqualTo(1);
    }

    @Test
    void withoutATimeOfTheirOwnTheFilesFollowTheDatabaseRunAsBefore() {
        db.jdbc.update("update backup_policy set scope_json = '{\"components\":[\"DATABASE\",\"OBJECT_STORE\"]}'::jsonb");
        assertThat(scheduler.filesHaveOwnSchedule()).isFalse();
        assertThat(scheduler.lastDue(at("2026-10-08T10:00:00+07:00"), BackupScheduler.Part.FILES)).isEmpty();
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        assertThat(next()).doesNotContain("components");
        scheduler.tick(at("2026-10-08T10:01:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isEqualTo(1);
    }

    @Test
    void aFilesScheduleIsIgnoredWhenTheFilesAreNotPartOfThePolicy() {
        filesOnTheirOwnSchedule("{\"components\":[\"DATABASE\"]}");
        assertThat(scheduler.filesHaveOwnSchedule()).isFalse();
        scheduler.tick(at("2026-10-08T10:00:00+07:00"));
        assertThat(next()).doesNotContain("OBJECT_STORE");
        scheduler.tick(at("2026-10-08T10:01:00+07:00"));
        assertThat(db.jdbc.queryForObject("select count(*) from backup_job", Integer.class)).isEqualTo(1);
    }

    @Test
    void jobsAreClaimedOldestFirstAndOnlyOnce() {
        queue.enqueue("VERIFY", "{\"backupNumber\":\"a\"}", "u1");
        queue.enqueue("VERIFY", "{\"backupNumber\":\"b\"}", "u2");
        Optional<JobQueue.Job> first = queue.claimNext(5);
        Optional<JobQueue.Job> second = queue.claimNext(5);
        assertThat(first).isPresent();
        assertThat(first.get().requestedBy()).isEqualTo("u1");
        assertThat(second.get().requestedBy()).isEqualTo("u2");
        assertThat(queue.claimNext(5)).isEmpty();
    }

    @Test
    void aJobWhoseLeaseRanOutBecauseTheAgentDiedIsGivenToTheNextClaim() {
        java.util.UUID id = queue.enqueue("VERIFY", "{\"backupNumber\":\"a\"}", "u1");
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
