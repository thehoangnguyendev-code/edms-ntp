package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class TrainingParticipantQueryTest {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    TrainingAccess access = mock(TrainingAccess.class);
    TrainingStore store = mock(TrainingStore.class);
    UserAccount actor = new UserAccount();
    UUID id = UUID.randomUUID(), department = UUID.randomUUID(), session = UUID.randomUUID();
    TrainingActivityService service;

    @BeforeEach void setup() {
        service = spy(new TrainingActivityService(jdbc, access, store, null, null, null, null, null, null, null, null, null));
        when(store.activity(id)).thenReturn(Optional.of(Map.of("organizer_department_id", department)));
    }

    @Test void deniedObjectScopeRunsNoParticipantQuery() {
        doThrow(new SecurityException("DENIED")).when(access).requireScope(actor, department);
        assertThatThrownBy(() -> service.participantPage(actor, id, session, "ALL", "", 1, 10)).isInstanceOf(SecurityException.class);
        verify(access).require(actor, "training.activity.view");
        // the only question asked is whether the person is the head of a department of the activity; no participant is read
        verify(jdbc).queryForObject(contains("department_head_id"), eq(Integer.class), any(Object[].class));
        verifyNoMoreInteractions(jdbc);
    }

    @Test void filtersAreBoundBeforeCountAndPageAndUnknownGroupIsRefused() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(12L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        var page = service.participantPage(actor, id, session, "ABSENT", "e%_", 2, 10);
        assertThat(page.pagination().total()).isEqualTo(12);
        assertThat(page.pagination().totalPages()).isEqualTo(2);
        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        var args = org.mockito.ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForObject(sql.capture(), eq(Long.class), args.capture());
        assertThat(sql.getValue()).contains("p.activity_id=?", "p.session_id=?", "p.person_user_id is not null", "planned_absence", "like ?").doesNotContain("e%_");
        assertThat(args.getValue()).containsExactly(id, session, "%e\\%\\_%", "%e\\%\\_%");
        verify(jdbc).queryForList(contains("order by lower(p.full_name), p.id limit ? offset ?"), eq(id), eq(session), eq("%e\\%\\_%"), eq("%e\\%\\_%"), eq(10), eq(10L));
        assertThatThrownBy(() -> service.participantPage(actor, id, null, "SQL", null, 1, 10)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void overviewSummariesDoNotRequireSendingTheRosterAndKeepLegacyDetailIntact() {
        var people = List.of(person("ATTENDED", "PASSED", "", true), person("INVITED", "PENDING", "planned", true),
                person("INVITED", "PENDING", "", true), person("ABSENT", "FAILED", "", false));
        var legacy = new LinkedHashMap<String, Object>(); legacy.put("participants", people); legacy.put("version", 7);
        doReturn(legacy).when(service).get(actor, id);
        var thin = service.overview(actor, id, session, false);
        assertThat((List<?>) thin.get("participants")).isEmpty();
        assertThat((List<?>) thin.get("sessionParticipants")).isEmpty();
        assertThat((List<?>) thin.get("supplementaryCandidates")).hasSize(1);
        @SuppressWarnings("unchecked") var summary = (Map<String, Object>) thin.get("participantSummary");
        @SuppressWarnings("unchecked") var stats = (Map<String, Long>) summary.get("all");
        assertThat(stats).containsEntry("total", 4L).containsEntry("attendancePending", 1L).containsEntry("eligible", 1L).containsEntry("passed", 1L).containsEntry("failed", 1L).containsEntry("absent", 2L);
        var editing = service.overview(actor, id, session, true);
        assertThat(editing.get("participants")).isEqualTo(people);
        assertThat(editing.get("version")).isEqualTo(7);
        assertThat(legacy.get("participants")).isEqualTo(people);
    }

    private Map<String, Object> person(String state, String result, String absence, boolean employee) {
        var p = new HashMap<String, Object>();
        p.put("state", state); p.put("result", result); p.put("plannedAbsence", absence); p.put("sessionId", session);
        p.put("personUserId", employee ? UUID.randomUUID() : null);
        return p;
    }

    @Test void sortsOnlyByAListedColumnAndKeepsTheNameOrderAsTheTieBreak() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(1L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        service.participantPage(actor, id, session, "EMPLOYEES", null, 1, 10, "department", "desc");
        service.participantPage(actor, id, session, "EMPLOYEES", null, 1, 10, "p.id; drop table x", "asc");
        var sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getAllValues().get(0)).contains("order by lower(p.department) desc nulls last, lower(p.full_name), p.id");
        assertThat(sql.getAllValues().get(1)).contains("order by lower(p.full_name), p.id").doesNotContain("drop table");
    }
}
