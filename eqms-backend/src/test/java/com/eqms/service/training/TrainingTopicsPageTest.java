package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The paged topic list for the Training Topics screen: the sort key is a whitelist, the page is bounded, and the total is real. */
@ExtendWith(MockitoExtension.class)
class TrainingTopicsPageTest {

    @Mock JdbcTemplate jdbc;

    private TrainingMatrixService service() {
        TrainingAccess access = mock(TrainingAccess.class);
        return new TrainingMatrixService(jdbc, access, null, null, null, null, null, null);
    }

    @Test
    void theTotalAndThePageComeFromTheDatabaseAndPagesAreCounted() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(23L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("code", "GMP")));

        Map<String, Object> result = service().topicsPage(actor(), "gmp", null, null, "name", "asc", 2, 10);

        assertThat(result.get("pagination")).isEqualTo(Map.of("page", 2, "limit", 10, "total", 23L, "totalPages", 3L));
    }

    @Test
    void anUnknownSortKeyIsNotPutIntoTheSql() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(0L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        service().topicsPage(actor(), null, null, null, "name; drop table training_topics", "asc", 1, 10);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getValue()).contains("order by t.code asc").doesNotContain("drop table");
    }

    @Test
    void theLimitIsBoundedAndTheDirectionDefaultsToAscending() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any())).thenReturn(0L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        Map<String, Object> result = service().topicsPage(actor(), null, null, null, "scope", "sideways", 1, 500);

        assertThat(result.get("pagination")).isEqualTo(Map.of("page", 1, "limit", 100, "total", 0L, "totalPages", 1L));
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getValue()).contains("order by t.scope asc");
    }

    @Test
    void aKnownScopeAndStatusNarrowTheListAndAnUnknownOneIsIgnored() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(0L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        service().topicsPage(actor(), null, "DEPARTMENT_GENERAL", "Inactive", "code", "asc", 1, 10);
        ArgumentCaptor<String> narrowed = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> narrowedArgs = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForList(narrowed.capture(), narrowedArgs.capture());
        assertThat(narrowed.getValue()).contains("t.scope = ?").contains("not t.active");
        assertThat(List.of(narrowedArgs.getValue())).contains("DEPARTMENT_GENERAL");

        org.mockito.Mockito.clearInvocations(jdbc);
        service().topicsPage(actor(), null, "WHATEVER; drop table x", "Everything", "code", "asc", 1, 10);
        ArgumentCaptor<String> ignored = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(ignored.capture(), any(Object[].class));
        assertThat(ignored.getValue()).doesNotContain("t.scope = ?").doesNotContain(" and t.active").doesNotContain("not t.active").doesNotContain("drop table");
    }

    private static UserAccount actor() {
        return mock(UserAccount.class);
    }
}
