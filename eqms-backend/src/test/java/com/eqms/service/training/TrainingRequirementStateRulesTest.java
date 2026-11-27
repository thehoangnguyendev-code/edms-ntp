package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** What the screens make of the standing that training_requirement_state gives (DEC-TRAINING-2026-11-27-01 A1). The function itself is checked by a SQL script kept with the change record. */
class TrainingRequirementStateRulesTest {

    @Test
    void aJobAssignmentIsStoppedByNeverTrainedAndByARevisionNotTrained() {
        assertTrue(TrainingJobAssignmentService.stillToTrain(Map.of("status", "MISSING")));
        assertTrue(TrainingJobAssignmentService.stillToTrain(Map.of("status", "UPDATE_NEEDED")));
    }

    @Test
    void aPeriodicTrainingThatIsDueDoesNotStopAJobAssignment() {
        assertFalse(TrainingJobAssignmentService.stillToTrain(Map.of("status", "DUE")));
        assertFalse(TrainingJobAssignmentService.stillToTrain(Map.of("status", "OK")));
    }

    @Test
    void theMatrixShowsAnOpenTrainingOnlyForAPersonWhoIsNotUpToDate() {
        assertEquals("QUALIFIED", TrainingMatrixCompletionService.state("OK", true));
        assertEquals("IN_PROGRESS", TrainingMatrixCompletionService.state("MISSING", true));
        assertEquals("IN_PROGRESS", TrainingMatrixCompletionService.state("UPDATE_NEEDED", true));
        assertEquals("REQUIRED", TrainingMatrixCompletionService.state("MISSING", false));
        assertEquals("UPDATE_NEEDED", TrainingMatrixCompletionService.state("UPDATE_NEEDED", false));
        assertEquals("DUE", TrainingMatrixCompletionService.state("DUE", false));
    }
}
