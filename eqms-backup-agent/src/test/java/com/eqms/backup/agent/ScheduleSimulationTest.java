package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.restore.RestoreRehearsalService;
import com.eqms.backup.agent.restore.WeeklyV2Verification;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.scheduling.support.CronExpression;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Time-based behaviour of the weekly V2 verification (SDS 14.1) run over weeks on a simulated clock. Nothing waits: the test moves
 * the clock to each Monday 05:00 and each daily 06:00 and runs the same methods the scheduler runs. The rehearsal itself is not
 * executed here (it is covered by RestoreRehearsalTest); its outcome is written the way the rehearsal writes it.
 */
class ScheduleSimulationTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** A Monday, 2026-10-05, 00:00 in Vietnam time. */
    private static final ZonedDateTime START = ZonedDateTime.of(2026, 10, 5, 0, 0, 0, 0, ZONE);

    @TempDir
    Path tmp;

    /** A clock that the test moves. Anything that reads time through it sees the simulated moment. */
    static final class SimulatedClock extends Clock {
        private Instant now;

        SimulatedClock(Instant start) {
            this.now = start;
        }

        void moveTo(Instant instant) {
            this.now = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    ControlDbTestSupport db;
    AgentProperties properties;
    LedgerService ledger;
    BackupRepository repository;
    SimulatedClock clock;
    RestoreRehearsalService rehearsals;
    WeeklyV2Verification weekly;
    /** What a passed rehearsal does in the test: the check outcome is written; the rehearsal runs elsewhere. */
    boolean checkPasses = true;
    int rehearsalSeq;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        properties = new AgentProperties();
        properties.setRole("RESTORE_WORKER");
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        repository = new BackupRepository(db.jdbc);
        clock = new SimulatedClock(START.toInstant());
        rehearsals = mock(RestoreRehearsalService.class);
        // the scheduled check asks for a rehearsal: record the request, and its outcome, at the simulated moment
        when(rehearsals.request(anyString(), anyString(), anyString())).thenAnswer(invocation -> {
            String id = recordRequest();
            if (checkPasses) recordPassed(id);
            return Map.of("rehearsalId", id);
        });
        weekly = new WeeklyV2Verification(db.jdbc, rehearsals, ledger, properties, repository, clock);
        // one completed backup whose verification passed, so that there is something to check
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values ('BK-SIM-0001', 'DEV', 'FULL', 'SCHEDULED', 'COMPLETED', ?, 'simulation')", java.sql.Timestamp.from(START.toInstant().minus(Duration.ofDays(1))));
        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) "
                + "select id, 'V1', 'VERIFIED', '{}'::jsonb, ?, 'simulation' from backup_run where backup_number = 'BK-SIM-0001'",
                java.sql.Timestamp.from(START.toInstant().minus(Duration.ofDays(1))));
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private String recordRequest() {
        String id = "RH-SIM-" + (++rehearsalSeq);
        db.jdbc.update("insert into restore_rehearsal(rehearsal_id, run_id, status, requested_by, reason, requested_at) "
                + "select ?, id, 'QUEUED', 'system:V2', 'simulated weekly check', ? from backup_run where backup_number = 'BK-SIM-0001'",
                id, java.sql.Timestamp.from(clock.instant()));
        return id;
    }

    private void recordPassed(String rehearsalId) {
        db.jdbc.update("update restore_rehearsal set status = 'PASSED', finished_at = ? where rehearsal_id = ?", java.sql.Timestamp.from(clock.instant()), rehearsalId);
        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) "
                + "select id, 'V2', 'VERIFIED', '{}'::jsonb, ?, 'system:V2' from backup_run where backup_number = 'BK-SIM-0001'",
                java.sql.Timestamp.from(clock.instant()));
    }

    private static Instant at(ZonedDateTime local) {
        return local.toInstant();
    }

    /**
     * Runs what the scheduler runs on each day from {@code fromDay} for {@code days} days: on each Monday the weekly check (when the
     * week is not skipped), and at 06:00 every day the catch-up. Days count from START; the clock only moves forward.
     */
    private void simulate(int fromDay, int days, java.util.function.IntPredicate weeklyRunsThisWeek) {
        for (int d = fromDay; d < fromDay + days; d++) {
            ZonedDateTime day = START.plusDays(d);
            int week = d / 7;
            if (day.getDayOfWeek().getValue() == 1 && weeklyRunsThisWeek.test(week)) {
                clock.moveTo(at(day.withHour(5)));
                weekly.weekly();
            }
            clock.moveTo(at(day.withHour(6)));
            weekly.catchUp();
        }
    }

    private long events(String name) {
        return ledger.all().stream().filter(e -> e.event().equals(name)).count();
    }

    private long alerts(String code) {
        return db.jdbc.queryForObject("select count(*) from backup_alert where code = ?", Long.class, code);
    }

    private long verifiedV2() {
        return db.jdbc.queryForObject("select count(*) from backup_verification where tier = 'V2' and result = 'VERIFIED'", Long.class);
    }

    @Test
    void theScheduleExpressionsFireAtTheTimesTheSdsNames() {
        ZonedDateTime from = ZonedDateTime.of(2026, 10, 10, 0, 0, 0, 0, ZONE);
        CronExpression weeklyCheck = CronExpression.parse("0 0 5 * * MON");
        CronExpression dailyCatchUp = CronExpression.parse("0 0 6 * * *");
        assertThat(weeklyCheck.next(from)).isEqualTo(ZonedDateTime.of(2026, 10, 12, 5, 0, 0, 0, ZONE));
        assertThat(weeklyCheck.next(weeklyCheck.next(from))).isEqualTo(ZonedDateTime.of(2026, 10, 19, 5, 0, 0, 0, ZONE));
        assertThat(dailyCatchUp.next(from)).isEqualTo(ZonedDateTime.of(2026, 10, 10, 6, 0, 0, 0, ZONE));
    }

    @Test
    void onScheduleForEightWeeksMeansNoMissedCheckAndNoOverdueWarning() {
        simulate(0, 8 * 7, week -> true);
        assertThat(events("MISSED")).isZero();
        assertThat(alerts("BACKUP_V2_MISSED")).isZero();
        assertThat(alerts("BACKUP_V2_OVERDUE")).isZero();
        assertThat(verifiedV2()).isEqualTo(8);
    }

    @Test
    void oneSkippedWeekIsCaughtUpOnceAndWarnedOnce() {
        // week 3 (the fourth Monday) is skipped by the scheduler
        simulate(0, 8 * 7, week -> week != 3);
        assertThat(events("MISSED")).as("the gap is noticed once").isEqualTo(1);
        assertThat(alerts("BACKUP_V2_MISSED")).isEqualTo(1);
        assertThat(verifiedV2()).as("seven weekly checks and the one catch-up").isEqualTo(8);
        assertThat(alerts("BACKUP_V2_OVERDUE")).as("the check was not overdue: it ran in the same week").isZero();
    }

    @Test
    void aThreeWeekCycleWouldRaiseMissedWarningsUnderTheCurrentSevenDayRule() {
        // Assumption for testing only (not a policy decision): one check every 21 days instead of every 7.
        simulate(0, 9 * 7, week -> week % 3 == 0);
        long missed = events("MISSED");
        assertThat(missed).as("each 21-day gap is longer than the 7 days the rule allows").isGreaterThanOrEqualTo(2);
        assertThat(alerts("BACKUP_V2_MISSED")).isEqualTo(missed);
    }

    @Test
    void aBackupWithoutAPassedCheckForEightDaysIsOverdue() {
        simulate(0, 14, week -> true);
        assertThat(alerts("BACKUP_V2_OVERDUE")).isZero();

        // from day 14 on every check fails: nothing passes, so the last pass (day 7) ages past the eight days
        checkPasses = false;
        simulate(14, 24, week -> true);
        assertThat(alerts("BACKUP_V2_OVERDUE")).as("warned once the last pass is eight days old, then daily while it stays overdue").isGreaterThanOrEqualTo(1);
    }

    @Test
    void theOverdueThresholdIsNotCrossedEarly() {
        simulate(0, 14, week -> true);
        // the last pass is the second Monday at 05:00; two hours before the eight days are up, the threshold is still not crossed
        Instant lastPass = at(START.plusDays(7).withHour(5));
        clock.moveTo(lastPass.plus(Duration.ofDays(8)).minus(Duration.ofHours(2)));
        weekly.catchUp();
        assertThat(alerts("BACKUP_V2_OVERDUE")).isZero();
    }
}
