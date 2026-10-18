package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MyTrainingQueryServiceTest {
    JdbcTemplate jdbc;
    TrainingAccess access;
    MyTrainingQueryService service;
    UserAccount actor;

    @BeforeEach void setup() {
        jdbc = mock(JdbcTemplate.class);
        access = mock(TrainingAccess.class);
        service = new MyTrainingQueryService(jdbc, access);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(21L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
    }

    @Test void tasksAlwaysUseAuthenticatedActorAndDatabasePaging() {
        var result = service.list(actor, "tasks", Map.of("personId", UUID.randomUUID().toString(), "page", "2", "limit", "10", "method", "SELF_READING", "search", "100%_done"));
        var sql = ArgumentCaptor.forClass(String.class);
        var args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForList(sql.capture(), args.capture());
        assertTrue(sql.getValue().contains("p.person_user_id = ?"));
        assertTrue(sql.getValue().contains("order by q.due_date asc nulls last, q.participant_id asc limit ? offset ?"));
        assertEquals(actor.getId(), args.getValue()[0]);
        assertTrue(List.of(args.getValue()).contains("%100\\%\\_done%"));
        assertEquals(10L, args.getValue()[args.getValue().length - 1]);
        assertEquals(21L, ((Map<?, ?>) result.get("pagination")).get("total"));
        verify(access).require(actor, "training.self.view");
    }

    @Test void signatureUnionScopesAssignmentsAndReceiverJobsBeforeFilteringAndPaging() {
        service.list(actor, "approvals", Map.of("stepCode", "RECEIVER_ACCEPT", "sortBy", "trainingTitle", "sortDirection", "desc"));
        var sql = ArgumentCaptor.forClass(String.class);
        var args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForList(sql.capture(), args.capture());
        assertTrue(sql.getValue().contains("a.assignee_user_id = ? and a.status = 'PENDING'"));
        assertTrue(sql.getValue().contains("j.person_user_id = ? and j.status = 'PENDING_RECEIVER'"));
        assertTrue(sql.getValue().contains("union all"));
        assertEquals(actor.getId(), args.getValue()[0]);
        assertEquals(actor.getId(), args.getValue()[1]);
        assertEquals("RECEIVER_ACCEPT", args.getValue()[2]);
    }

    @Test void recordsApplyBoundFiltersAndClampOutOfRangePage() {
        var result = service.list(actor, "records", Map.of("method", "CLASSROOM", "result", "PASSED", "recordState", "VALID", "fromDate", "2026-10-01", "toDate", "2026-10-16", "page", "999", "limit", "500", "sortBy", "trainingNumber"));
        var pagination = (Map<?, ?>) result.get("pagination");
        assertEquals(100, pagination.get("limit"));
        assertEquals(1, pagination.get("page"));
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertTrue(sql.getValue().contains("r.person_user_id = ?"));
        assertTrue(sql.getValue().contains("q.record_state = ?"));
        assertTrue(sql.getValue().contains("completed_on >= ?"));
        assertTrue(sql.getValue().contains("completed_on <= ?"));
    }

    @Test void rejectsSortInjectionAndReversedDatesWithoutReadingData() {
        assertThrows(IllegalArgumentException.class, () -> service.list(actor, "tasks", Map.of("sortBy", "trainingTitle; drop table training_records")));
        assertThrows(IllegalArgumentException.class, () -> service.list(actor, "tasks", Map.of("sortDirection", "desc; --")));
        assertThrows(IllegalArgumentException.class, () -> service.list(actor, "records", Map.of("fromDate", "2026-10-16", "toDate", "2026-10-01")));
        assertThrows(IllegalArgumentException.class, () -> service.list(actor, "unknown", Map.of()));
        verifyNoInteractions(jdbc);
    }

    @Test void refusesCallerWithoutSelfViewBeforeAnyQuery() {
        doThrow(new SecurityException("TRAINING_SCOPE_DENIED")).when(access).require(actor, "training.self.view");
        assertThrows(SecurityException.class, () -> service.list(actor, "tasks", Map.of()));
        verifyNoInteractions(jdbc);
    }
}
