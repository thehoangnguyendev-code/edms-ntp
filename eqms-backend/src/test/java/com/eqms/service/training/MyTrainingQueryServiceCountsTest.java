package com.eqms.service.training;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** The badge of My Tasks: what waits for the person, and only for a person who may see their own training. */
class MyTrainingQueryServiceCountsTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingAccess access = mock(TrainingAccess.class);
    private final MyTrainingQueryService service = new MyTrainingQueryService(jdbc, access);
    private final UserAccount actor = mock(UserAccount.class);

    @Test
    void theBadgeIsTheTasksPlusTheSignaturesAskedOfThePerson() {
        UUID id = UUID.randomUUID();
        when(actor.getId()).thenReturn(id);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(id))).thenReturn(3L);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(id), eq(id))).thenReturn(2L);
        assertEquals(Map.of("tasks", 3L, "signatures", 2L, "total", 5L), service.counts(actor));
        verify(access).require(actor, "training.self.view");
    }

    @Test
    void aPersonWithoutThePermissionGetsNothingAndNothingIsRead() {
        doThrow(new SecurityException("denied")).when(access).require(any(), eq("training.self.view"));
        assertThrows(SecurityException.class, () -> service.counts(actor));
        verify(jdbc, never()).queryForObject(anyString(), eq(Long.class), any(Object[].class));
    }
}
