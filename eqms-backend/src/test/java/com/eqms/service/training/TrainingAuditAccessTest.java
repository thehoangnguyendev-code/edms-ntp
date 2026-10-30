package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TrainingAuditAccessTest {
    private final TrainingActivityService activities = mock(TrainingActivityService.class);
    private final TrainingMatrixService matrices = mock(TrainingMatrixService.class);
    private final TrainingAssessmentLibraryService assessments = mock(TrainingAssessmentLibraryService.class);
    private final TrainingJobAssignmentService jobs = mock(TrainingJobAssignmentService.class);
    private final TrainingPersonnelReviewService reviews = mock(TrainingPersonnelReviewService.class);
    private final TrainingRequirementService requirements = mock(TrainingRequirementService.class);
    private final TrainingSpecimenService specimens = mock(TrainingSpecimenService.class);
    private final TrainingAuditAccess access = new TrainingAuditAccess(activities, matrices, assessments, jobs, reviews, requirements, specimens);
    private final UserAccount actor = new UserAccount();
    private final UUID id = UUID.randomUUID();

    @Test
    void theAuditTrailOfARecordIsReadWithTheSameCheckAsItsDetail() {
        assertTrue(access.require(actor, "TRAINING_ASSESSMENT", id));
        verify(assessments).get(actor, id);
        assertTrue(access.require(actor, "TRAINING ASSESSMENT", id), "the module may be written with spaces");
        assertTrue(access.require(actor, "TRAINING_MATRIX", id));
        verify(matrices).version(actor, id);
    }

    @Test
    void whoCannotOpenTheRecordCannotReadItsAuditTrail() {
        when(assessments.get(any(), any())).thenThrow(new SecurityException("denied"));
        assertEquals("denied", assertThrows(SecurityException.class, () -> access.require(actor, "TRAINING_ASSESSMENT", id)).getMessage());
    }

    @Test
    void aModuleWithoutADetailScreenIsLeftToTheOtherRules() {
        assertFalse(access.require(actor, "TRAINING_VENDOR", id));
        verifyNoInteractions(activities, matrices, assessments, jobs, reviews, requirements, specimens);
    }
}
