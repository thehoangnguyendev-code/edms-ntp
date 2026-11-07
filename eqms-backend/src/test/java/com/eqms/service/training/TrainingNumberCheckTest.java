package com.eqms.service.training;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Manual Training Numbers: TRN/&lt;department code&gt;/YY-NNN, the department of the training, duplicates, and a year other than this one as a warning only. */
class TrainingNumberCheckTest {
    private JdbcTemplate jdbc;
    private TrainingNumberService numbers;
    private final UUID department = UUID.randomUUID();
    private final String yy = String.format("%02d", LocalDate.now(TrainingNumberService.ZONE).getYear() % 100);

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        numbers = new TrainingNumberService(jdbc);
        when(jdbc.queryForList(contains("from departments"), any(Object[].class))).thenReturn(List.of(Map.of("code", "DC")));
        when(jdbc.queryForList(contains("from training_activities"), any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForList(contains("from document_revisions"), any(Object[].class))).thenReturn(List.of());
    }

    @Test
    void aFreeNumberOfTheRightShapeInTheRightDepartmentIsValid() {
        var check = numbers.check(department, "trn/dc/" + yy + "-014", null);
        assertTrue(check.valid());
        assertEquals("TRN/DC/" + yy + "-014", check.number());
        assertFalse(check.otherYear());
    }

    @Test
    void theShapeAndTheDepartmentCodeAreChecked() {
        assertEquals("TRAINING_NUMBER_FORMAT", numbers.check(department, "TRN-DC-" + yy + "-014", null).code());
        assertEquals("TRAINING_NUMBER_FORMAT", numbers.check(department, "TRN/DC/" + yy + "-14", null).code());
        assertEquals("TRAINING_NUMBER_DEPARTMENT", numbers.check(department, "TRN/QA/" + yy + "-014", null).code());
        assertEquals("TRAINING_NUMBER_REQUIRED", numbers.check(department, " ", null).code());
        assertEquals("TRAINING_DEPARTMENT_REQUIRED", numbers.check(null, "TRN/DC/" + yy + "-014", null).code());
    }

    @Test
    void aNumberUsedByAnActivityIsRefusedAndNamesIt() {
        when(jdbc.queryForList(contains("from training_activities"), any(Object[].class)))
                .thenReturn(List.of(Map.of("training_number", "TRN/DC/" + yy + "-014", "status", "OPEN", "document_number", "SOP.0007")));
        var check = numbers.check(department, "TRN/DC/" + yy + "-014", null);
        assertFalse(check.valid());
        assertEquals("TRAINING_NUMBER_IN_USE", check.code());
        assertTrue(check.message().contains("SOP.0007"));
    }

    @Test
    void aNumberUsedByARevisionIsRefused() {
        when(jdbc.queryForList(contains("from document_revisions"), any(Object[].class)))
                .thenReturn(List.of(Map.of("document_number", "SOP.0009", "revision_number", "1.0.0")));
        assertEquals("TRAINING_NUMBER_IN_USE", numbers.check(department, "TRN/DC/" + yy + "-015", null).code());
    }

    @Test
    void aYearOtherThanThisOneIsOnlyAWarning() {
        int other = (LocalDate.now(TrainingNumberService.ZONE).getYear() - 1) % 100;
        var check = numbers.check(department, String.format("TRN/DC/%02d-014", other), null);
        assertTrue(check.valid());
        assertTrue(check.otherYear());
        assertEquals("TRAINING_NUMBER_OTHER_YEAR", check.code());
    }
}
