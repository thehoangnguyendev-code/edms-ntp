package com.eqms.service.training;

import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TrainingTranscriptionPageTest {
    @Test void deniedScopeStopsBeforeReadingTranscriptions() {
        var jdbc = mock(JdbcTemplate.class); var access = mock(TrainingAccess.class); var actor = new UserAccount();
        UUID activity = UUID.randomUUID(), department = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), eq(activity))).thenReturn(department);
        doThrow(new SecurityException("DENIED")).when(access).requireScope(actor, department);
        var service = new TrainingTranscriptionService(jdbc, access, null, null, null, null);
        assertThatThrownBy(() -> service.listPage(actor, activity, 1, 10)).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).queryForObject(contains("count(*)"), eq(Long.class), any());
        verify(jdbc, never()).queryForList(contains("training_transcriptions"), any(Object[].class));
    }

    @Test void pendingSessionsCoverTheWholeActivityEvenWhenThePageIsEmpty() {
        var jdbc = mock(JdbcTemplate.class); var access = mock(TrainingAccess.class); var actor = new UserAccount();
        UUID activity = UUID.randomUUID(), department = UUID.randomUUID(), pending = UUID.randomUUID();
        when(jdbc.queryForObject(anyString(), eq(UUID.class), eq(activity))).thenReturn(department);
        when(jdbc.queryForObject(contains("count(*)"), eq(Long.class), eq(activity))).thenReturn(21L);
        when(jdbc.queryForList(contains("select distinct session_id"), eq(UUID.class), eq(activity))).thenReturn(List.of(pending));
        when(jdbc.queryForList(contains("order by s.session_no"), eq(activity), eq(10), eq(10L))).thenReturn(List.of());
        var result = new TrainingTranscriptionService(jdbc, access, null, null, null, null).listPage(actor, activity, 2, 10);
        assertThat(result.get("pendingSessionIds")).isEqualTo(List.of(pending));
        assertThat(((PaginationResponse) result.get("pagination")).total()).isEqualTo(21);
        assertThat((List<?>) result.get("data")).isEmpty();
    }
}
