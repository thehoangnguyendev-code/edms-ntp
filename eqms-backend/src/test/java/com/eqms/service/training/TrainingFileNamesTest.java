package com.eqms.service.training;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** The name of the files downloaded from Training Management: the pattern of the administrator, the default, and a name a file system accepts. */
class TrainingFileNamesTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingFileNames names = new TrainingFileNames(jdbc);

    private void saved(String json) {
        when(jdbc.queryForList(anyString(), org.mockito.ArgumentMatchers.eq(String.class))).thenReturn(List.of(json));
    }

    @Test
    void theDefaultNameOfThePersonalRecordHasTheCodeWithTheRevisionTheEmployeeAndTheDate() {
        Map<String, String> v = new LinkedHashMap<>(Map.of("EMPLOYEE_CODE", "UAT31-019", "EMPLOYEE_NAME", "Mai Văn Tâm (UAT)", "DATE", "20261101"));
        assertEquals("APD.0014.02_UAT31-019_Mai-Van-Tam-(UAT)_20261101", names.name("APD.0014", "APD.0014.02", v));
    }

    @Test
    void theSlashesOfATrainingNumberAndTheAccentsNeverReachTheFileName() {
        assertEquals("APD.0117.01_TRN-QA-26-944a", names.name("APD.0117", "APD.0117.01", Map.of("TRAINING_NUMBER", "TRN/QA/26-944a")));
        assertEquals("Dang-Thi-Hoa", TrainingFileNames.sanitize("Đặng Thị Hòa"));
        assertEquals("a-b-c", TrainingFileNames.sanitize("a:b*c"));
    }

    @Test
    void aPatternOfTheAdministratorReplacesTheDefaultAndAnEmptyOneBringsTheDefaultBack() {
        saved("{\"APD.0117\":\"{TRAINING_NUMBER}__{FILE_CODE}\"}");
        assertEquals("TRN-QC-26-001__APD.0117.01", names.name("APD.0117", "APD.0117.01", Map.of("TRAINING_NUMBER", "TRN/QC/26-001")));
        saved("{\"APD.0117\":\"\"}");
        assertEquals("APD.0117.01_TRN-QC-26-001", names.name("APD.0117", "APD.0117.01", Map.of("TRAINING_NUMBER", "TRN/QC/26-001")));
    }

    @Test
    void aPatternWithAnUnknownVariableAPathOrNoVariableIsRefused() {
        assertTrue(TrainingFileNames.problems("APD.0117", "{FILE_CODE}_{TRAINING_NUMBER}").isEmpty());
        assertFalse(TrainingFileNames.problems("APD.0117", "{EMPLOYEE_NAME}").isEmpty());
        assertFalse(TrainingFileNames.problems("APD.0117", "../{FILE_CODE}").isEmpty());
        assertFalse(TrainingFileNames.problems("APD.0117", "fixed-name").isEmpty());
        assertFalse(TrainingFileNames.problems("APD.0117", "{FILE_CODE").isEmpty());
        assertTrue(TrainingFileNames.problems("APD.0117", "").isEmpty());
    }

    @Test
    void aNameIsAtMost120CharactersAndAnEmptyResultFallsBackToTheCode() {
        String longName = "x".repeat(300);
        assertTrue(names.name("APD.0014", "APD.0014.02", Map.of("EMPLOYEE_CODE", longName, "EMPLOYEE_NAME", "n")).length() <= 120);
        saved("{\"APD.0117\":\"{YEAR}\"}");
        assertTrue(names.name("APD.0117", "APD.0117.01", Map.of()).length() > 0);
    }

    @Test
    void everyFormHasADefaultPatternThatUsesOnlyItsOwnVariables() {
        for (TrainingFileNames.Form f : TrainingFileNames.FORMS) assertTrue(TrainingFileNames.problems(f.key(), f.defaultPattern()).isEmpty(), f.key());
    }
}
