package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TrainingJobPositionsTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingAccess access = mock(TrainingAccess.class);
    private final TrainingJobAssignmentService service = new TrainingJobAssignmentService(jdbc, access,
            mock(TrainingApprovalService.class), mock(ElectronicSignatureService.class), mock(AuditTrailService.class),
            mock(UserAccountRepository.class), mock(TrainingNotifier.class));
    private final UserAccount actor = mock(UserAccount.class);
    private final UUID assignment = UUID.randomUUID();
    private final UUID department = UUID.randomUUID();

    @Test void appliesExistingScopeBeforeSearchingAndEscapesWildcards() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(jdbc.queryForList(contains("select * from training_job_assignments"), eq(assignment)))
                .thenReturn(List.of(Map.of("person_user_id", UUID.randomUUID(), "department_id", department)));
        when(jdbc.queryForObject(contains("select count(*)"), eq(Long.class), eq(assignment), eq("%qa\\%\\_%"))).thenReturn(1L);
        when(jdbc.queryForList(contains("from training_job_assignment_roles ar"), eq(assignment), eq("%qa\\%\\_%"), eq(20), eq(0L)))
                .thenReturn(List.of(Map.of("id", "1", "name", "QA%, Senior", "carried", true)));
        var result = service.positions(actor, assignment, "QA%_", 1, 20);
        verify(access).requireScope(actor, department);
        @SuppressWarnings("unchecked") var rows = (List<Map<String, Object>>) result.get("data");
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.get("name")).isEqualTo("QA%, Senior");
            assertThat(row.get("carried")).isEqualTo(true);
        });
    }

    @Test void refusesOutsideScopeBeforeReadingPositions() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(jdbc.queryForList(contains("select * from training_job_assignments"), eq(assignment)))
                .thenReturn(List.of(Map.of("person_user_id", UUID.randomUUID(), "department_id", department)));
        doThrow(new SecurityException("denied")).when(access).requireScope(actor, department);
        assertThatThrownBy(() -> service.positions(actor, assignment, "", 1, 20)).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).queryForObject(contains("select count(*)"), eq(Long.class), eq(assignment), anyString());
    }

    @Test void countsAllMatchesAndBoundsTheRequestedPageSize() {
        UUID person = UUID.randomUUID();
        when(actor.getId()).thenReturn(person);
        when(jdbc.queryForList(contains("select * from training_job_assignments"), eq(assignment)))
                .thenReturn(List.of(Map.of("person_user_id", person)));
        when(jdbc.queryForObject(contains("select count(*)"), eq(Long.class), eq(assignment), eq("%review%"))).thenReturn(250L);
        when(jdbc.queryForList(contains("from training_job_assignment_roles ar"), eq(assignment), eq("%review%"), eq(100), eq(100L)))
                .thenReturn(List.of(Map.of("id", "2", "name", "Reviewer", "carried", false)));
        var result = service.positions(actor, assignment, "Review", 2, 1000);
        var pagination = (Map<?, ?>) result.get("pagination");
        assertThat(pagination.get("total")).isEqualTo(250L);
        assertThat(pagination.get("page")).isEqualTo(2);
        assertThat(pagination.get("limit")).isEqualTo(100);
        verify(jdbc).queryForList(contains("from training_job_assignment_roles ar"), eq(assignment), eq("%review%"), eq(100), eq(100L));
    }
}
