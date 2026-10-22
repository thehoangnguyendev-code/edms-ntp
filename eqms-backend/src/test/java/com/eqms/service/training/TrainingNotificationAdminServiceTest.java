package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.training.TrainingNotificationAdminService.LogQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The notice log and the manual reminder run: permission first, filters as parameters, honest counts, and an Audit Trail entry. */
@ExtendWith(MockitoExtension.class)
class TrainingNotificationAdminServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingReminderScheduler reminders;
    @Mock AuditTrailService audit;

    private final UserAccount actor = mock(UserAccount.class);

    private TrainingNotificationAdminService service() {
        return new TrainingNotificationAdminService(jdbc, access, reminders, audit);
    }

    private static LogQuery query(String search, String status, String channel, String from, String to, String sortBy, String direction) {
        return new LogQuery(search, status, channel, from, to, sortBy, direction, 1, 10);
    }

    @Test
    void aPersonWithoutThePermissionGetsNeitherTheLogNorARun() {
        doThrow(new SecurityException(TrainingAccess.DENIED)).when(access).require(any(UserAccount.class), anyString());

        assertThatThrownBy(() -> service().log(actor, query(null, null, null, null, null, null, "desc"))).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service().runReminders(actor)).isInstanceOf(SecurityException.class);

        verify(reminders, never()).sendAll(any());
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }

    @Test
    void theFiltersAndTheSortGoIntoTheQueryAsParametersAndAnUnknownSortOrStatusIsIgnored() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(0L);

        service().log(actor, query("due", "FAILED", "EMAIL", "2026-10-01", "2026-10-15", "recipient", "asc"));

        ArgumentCaptor<String> page = ArgumentCaptor.forClass(String.class);
        verify(jdbc, org.mockito.Mockito.atLeastOnce()).queryForList(page.capture(), any(Object[].class));
        String pageSql = page.getAllValues().stream().filter(s -> s.contains("limit ? offset ?")).findFirst().orElseThrow();
        assertThat(pageSql).contains("l.channel = ?").contains("l.status = ?").contains("order by u.full_name asc");

        org.mockito.Mockito.clearInvocations(jdbc);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        service().log(actor, query(null, "NONSENSE; drop table x", "FAX", null, null, "title; drop table x", "sideways"));
        verify(jdbc, org.mockito.Mockito.atLeastOnce()).queryForList(page.capture(), any(Object[].class));
        String ignored = page.getAllValues().stream().filter(s -> s.contains("limit ? offset ?")).reduce((a, b) -> b).orElseThrow();
        assertThat(ignored).doesNotContain("l.channel = ?").doesNotContain("l.status = ?").doesNotContain("drop table").contains("order by l.created_at desc");
    }

    @Test
    void aMalformedDateIsRefusedInsteadOfBeingIgnored() {
        assertThatThrownBy(() -> service().log(actor, query(null, null, null, "10/10/2026", null, null, "desc")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_DATE_INVALID");
    }

    @Test
    void theSortKeysAreAFixedList() {
        assertThat(TrainingNotificationAdminService.sortColumn("event")).isEqualTo("l.event_code");
        assertThat(TrainingNotificationAdminService.sortColumn("status")).isEqualTo("l.status");
        assertThat(TrainingNotificationAdminService.sortColumn("whatever")).isEqualTo("l.created_at");
        assertThat(TrainingNotificationAdminService.sortColumn(null)).isEqualTo("l.created_at");
    }

    @Test
    void aManualRunReportsWhatWasReallySentReadFromTheLogAndIsRecordedInTheAuditTrail() {
        when(jdbc.queryForObject(eq("select now()"), eq(java.sql.Timestamp.class))).thenReturn(java.sql.Timestamp.from(Instant.parse("2026-10-19T00:00:00Z")));
        when(reminders.sendAll(any())).thenReturn(5);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(
                Map.of("status", "SENT", "total", 3L), Map.of("status", "SKIPPED", "total", 2L)));

        Map<String, Object> result = service().runReminders(actor);

        assertThat(result).containsEntry("candidates", 5).containsEntry("sent", 3L).containsEntry("skipped", 2L).containsEntry("failed", 0L);
        ArgumentCaptor<String> comment = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("TRAINING_NOTIFICATIONS"), eq("TRAINING_NOTIFICATIONS"), any(), eq("TRAINING_REMINDERS_RUN"), any(), any(), comment.capture());
        assertThat(comment.getValue()).contains("candidates=5").contains("sent=3").contains("skipped=2").contains("failed=0");
    }
}
