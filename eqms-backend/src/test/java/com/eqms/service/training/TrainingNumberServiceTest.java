package com.eqms.service.training;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The Training Number counter never issues a number that a paper record or another revision already carries (Legacy Import), and goes on after the paper log. */
class TrainingNumberServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID department = UUID.randomUUID();
    private final int year = LocalDate.now(TrainingNumberService.ZONE).getYear();
    private final String yy = String.format("%02d", year % 100);
    private TrainingNumberService service;

    @BeforeEach
    void setUp() {
        service = new TrainingNumberService(jdbc);
        when(jdbc.queryForList(anyString(), eq(department))).thenReturn(List.of(Map.of("code", "QA")));
    }

    @Test
    void anUnusedNumberIsIssuedAsBefore() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(7);
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(false);
        TrainingNumberService.Issued issued = service.issueRoot(department);
        assertEquals("TRN/QA/" + yy + "-007", issued.baseNumber());
        assertEquals(7, issued.serial());
    }

    @Test
    void aNumberAlreadyTypedFromAPaperRecordIsSkipped() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(5, 6);
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(true, false);
        TrainingNumberService.Issued issued = service.issueRoot(department);
        assertEquals("TRN/QA/" + yy + "-006", issued.baseNumber());
        assertEquals(6, issued.serial());
    }

    @Test
    void whenEveryNumberIsTakenTheCounterGivesUpInsteadOfLooping() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.issueRoot(department));
    }

    @Test
    void aPaperNumberOfTheFormOfTheSystemRaisesTheCounterOfItsDepartmentAndYear() {
        UUID qa = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), eq(UUID.class), anyString())).thenReturn(List.of(qa));
        service.reserveFromPaper(" trn/qa/26-043 ");
        verify(jdbc).update(anyString(), eq(qa), eq(2026), eq(43));
    }

    @Test
    void aPaperNumberOfAnotherFormOrOfAnUnknownDepartmentChangesNothing() {
        when(jdbc.queryForList(anyString(), eq(UUID.class), anyString())).thenReturn(List.of());
        service.reserveFromPaper("pap/qa-19.012");
        service.reserveFromPaper("TRN/ZZ/26-001");
        service.reserveFromPaper(null);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
}
