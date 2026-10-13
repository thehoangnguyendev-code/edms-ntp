package com.eqms.backup.agent;

import com.eqms.backup.agent.api.BackupQueryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** The per-day counts behind the overview chart: real rows, every day present, and a run counted only on its own day. */
class DailyOverviewTest {

    ControlDbTestSupport db;
    BackupQueryService queries;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        queries = new BackupQueryService(db.jdbc);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private void run(String number, String status, String startedAtSql) {
        db.jdbc.update("insert into backup_run(backup_number, environment, type, trigger_kind, status, started_at, requested_by) "
                + "values (?, 'DEV', 'FULL', 'SCHEDULED', ?, " + startedAtSql + ", 'system')", number, status);
    }

    @Test
    void everyDayIsThereAndTheCountsLandOnTheirOwnDay() {
        run("BK-d0-ok", "COMPLETED", "now()");
        run("BK-d0-bad", "FAILED", "now()");
        run("BK-d1-ok", "COMPLETED", "now() - interval '1 day'");

        List<Map<String, Object>> days = queries.dailySummary(3);

        assertThat(days).hasSize(3);
        Map<String, Object> today = days.get(2);
        assertThat(today.get("completed")).isEqualTo(1L);
        assertThat(today.get("failed")).isEqualTo(1L);
        Map<String, Object> yesterday = days.get(1);
        assertThat(yesterday.get("completed")).isEqualTo(1L);
        assertThat(yesterday.get("failed")).isEqualTo(0L);
        // A day with nothing in it is a real zero, not a missing row.
        assertThat(days.get(0).get("completed")).isEqualTo(0L);
        assertThat(days.get(0).get("notVerified")).isEqualTo(0L);
    }

    @Test
    void aCompletedRunWithoutAPassingCheckCountsAsNotVerified() {
        run("BK-unchecked", "COMPLETED", "now()");

        List<Map<String, Object>> days = queries.dailySummary(1);

        assertThat(days.get(0).get("notVerified")).isEqualTo(1L);
    }

    @Test
    void daysAreOldestFirstAndEndOnToday() {
        List<Map<String, Object>> days = queries.dailySummary(5);
        assertThat(days.get(4).get("date")).isEqualTo(java.time.LocalDate.now().toString());
        assertThat(days.get(0).get("date").toString().compareTo(days.get(4).get("date").toString())).isLessThan(0);
    }
}
