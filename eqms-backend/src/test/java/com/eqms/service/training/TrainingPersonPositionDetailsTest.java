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
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.Mockito.*;

class TrainingPersonPositionDetailsTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingAccess access = mock(TrainingAccess.class);
    private final UserAccount actor = mock(UserAccount.class);
    private final TrainingMatrixService service = new TrainingMatrixService(jdbc, access, mock(TrainingStore.class),
            mock(TrainingApprovalService.class), mock(ElectronicSignatureService.class), mock(AuditTrailService.class),
            mock(UserAccountRepository.class), mock(TrainingNotifier.class));
    private final UUID personId = UUID.randomUUID();

    @Test void deniesPeopleOutsideTheCurrentDepartmentBeforeReadingPositions() {
        when(actor.getDepartment()).thenReturn("QA");
        when(jdbc.queryForObject(contains("from app_users u"), eq(Integer.class), any(Object[].class))).thenReturn(0);
        assertThatThrownBy(() -> service.personPositionDetails(actor, personId, "", 1, 20)).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).queryForList(contains("from training_person_positions"), any(Object[].class));
    }

    @Test void searchesAndPagesWithinTheSameDepartmentScope() {
        when(actor.getDepartment()).thenReturn("QA");
        when(jdbc.queryForObject(contains("from app_users u"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(contains("from training_person_positions"), eq(Long.class), any(Object[].class))).thenReturn(25L);
        when(jdbc.queryForList(contains("from training_person_positions"), any(Object[].class))).thenReturn(List.of(Map.of("id", "p1", "name", "QA%, Senior", "carried", false)));
        var result = service.personPositionDetails(actor, personId, "QA%", 2, 20);
        @SuppressWarnings("unchecked") var rows = (List<Map<String, Object>>) result.get("data");
        assertThat(rows.getFirst().get("name")).isEqualTo("QA%, Senior");
        var pagination = (Map<?, ?>) result.get("pagination");
        assertThat(pagination.get("total")).isEqualTo(25L);
        assertThat(pagination.get("page")).isEqualTo(2);
        verify(jdbc).queryForList(contains("lower(trim(u.department))"), aryEq(new Object[]{personId, "%qa\\%%", "QA", 20, 20L}));
    }
}
