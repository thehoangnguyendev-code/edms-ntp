package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingActivityService.ListFilters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The list of Training Activities: every sortable column has a fixed expression, the new filters travel as parameters, and a bad date or sort is refused. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingActivityListFiltersTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingActivityService service;

    @BeforeEach
    void setUp() {
        when(access.allDepartments(actor)).thenReturn(true);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(0L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        service = new TrainingActivityService(jdbc, access, null, null, null, null, null, null, null, null, null, null);
    }

    private String pageSql(String sortBy, ListFilters filters) {
        service.list(actor, null, null, null, (UUID) null, null, null, false, filters, sortBy, "asc", 1, 10);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, org.mockito.Mockito.atLeastOnce()).queryForList(sql.capture(), any(Object[].class));
        return sql.getAllValues().stream().filter(s -> s.contains("limit ? offset ?")).reduce((a, b) -> b).orElseThrow();
    }

    @Test
    void everyColumnOfTheTableCanBeSortedByAndTheExpressionIsFixed() {
        for (String key : List.of("topics", "trainers", "methods", "kindReason", "documentNumber", "participantCount", "attendedCount", "passedCount", "scheduledOn", "dueDate", "createdByName")) {
            assertThat(pageSql(key, ListFilters.NONE)).contains(" order by ").doesNotContain(key + ";");
        }
        assertThatThrownBy(() -> service.list(actor, null, null, null, (UUID) null, null, null, false, ListFilters.NONE, "title; drop table x", "asc", 1, 10))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_SORT_NOT_ALLOWED");
    }

    @Test
    void theNewFiltersAreParametersOfTheQuery() {
        String sql = pageSql("createdAt", new ListFilters("CLASSROOM", "NEW_SOP", true, "2026-10-01", "2026-10-31", "2026-11-01", "2026-11-30", "2026-09-01", "2026-09-30"));

        assertThat(sql).contains("s.method = ?").contains("t.kind_reason = ?").contains("s.delivery_mode <> 'ELECTRONIC'")
                .contains("s.scheduled_on >= ?").contains("s.scheduled_on <= ?").contains("t.due_date >= ?").contains("t.due_date <= ?")
                .contains("t.created_at >= ?").contains("t.created_at < ?").doesNotContain("CLASSROOM").doesNotContain("NEW_SOP");
    }

    @Test
    void aMalformedDateIsRefusedInsteadOfIgnored() {
        assertThatThrownBy(() -> service.list(actor, null, null, null, (UUID) null, null, null, false, new ListFilters(null, null, null, "01/10/2026", null, null, null, null, null), "createdAt", "desc", 1, 10))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_DATE_INVALID");
    }
}
