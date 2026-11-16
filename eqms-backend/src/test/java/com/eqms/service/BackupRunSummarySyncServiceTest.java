package com.eqms.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** REPORT-BACKUP-RUNS-2026-11-15: with no password the copy of the backup run summary is off, and a pass then touches neither database. */
class BackupRunSummarySyncServiceTest {
    @Test
    void withNoPasswordTheCopyIsOffAndNothingIsRead() {
        var jdbc = mock(JdbcTemplate.class);
        var service = new BackupRunSummarySyncService(jdbc, mock(DistributedSchedulerLockService.class), mock(BackupAgentClient.class), "jdbc:postgresql://nowhere/none", "eqms_backup_report_ro", "");
        assertFalse(service.enabled());
        assertEquals(-1, service.sync());
        verifyNoInteractions(jdbc);
    }

    @Test
    void anUnreachableControlDatabaseIsKeptAsTheReasonAndDoesNotThrow() {
        var jdbc = mock(JdbcTemplate.class);
        var service = new BackupRunSummarySyncService(jdbc, mock(DistributedSchedulerLockService.class), mock(BackupAgentClient.class), "jdbc:postgresql://127.0.0.1:1/none", "u", "a-password-that-is-not-used");
        assertTrue(service.enabled());
        assertEquals(-1, service.sync());
        verify(jdbc).update(eq("update backup_run_summary_sync set last_attempt_at=now() where id=1"));
        verify(jdbc).update(eq("update backup_run_summary_sync set last_error=? where id=1"), anyString());
    }

    private BackupRunSummarySyncService withStatus(boolean behind, Object attempt, BackupAgentClient agent) {
        var jdbc = mock(JdbcTemplate.class);
        var row = new java.util.HashMap<String, Object>();
        row.put("last_attempt_at", attempt);
        row.put("last_success_at", null);
        row.put("last_rows", null);
        row.put("last_error", "SQLException: connection refused");
        row.put("behind", behind);
        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(row);
        return new BackupRunSummarySyncService(jdbc, mock(DistributedSchedulerLockService.class), agent, "jdbc:postgresql://nowhere/none", "u", "a-password-that-is-not-used");
    }

    @Test
    void aCopyWithNoSuccessForThirtyMinutesIsOutOfDateAndTheAgentIsToldOnce() {
        var agent = mock(BackupAgentClient.class);
        var service = withStatus(true, "2026-11-15 02:10:00+00", agent);
        assertEquals(true, service.status().get("stale"));
        service.raiseAlertIfStale();
        verify(agent).exchange(eq(org.springframework.http.HttpMethod.POST), eq("/internal/alerts/external"),
                argThat(body -> "REPORT_COPY_STALE".equals(body.get("code")) && String.valueOf(body.get("detail")).contains("connection refused")));
    }

    @Test
    void aFreshCopyOrOneNeverTriedYetRaisesNothing() {
        var agent = mock(BackupAgentClient.class);
        withStatus(false, "2026-11-15 02:10:00+00", agent).raiseAlertIfStale();
        withStatus(true, null, agent).raiseAlertIfStale();
        verifyNoInteractions(agent);
    }
}
