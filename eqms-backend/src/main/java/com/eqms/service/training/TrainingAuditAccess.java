package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

/**
 * The Audit Trail tab of a Training detail screen is part of the detail: whoever may open the record may read its audit trail, so there is no separate audit permission. The check is the
 * read of the record itself, by the service that serves the detail screen (its permission and its scope), and nothing else.
 */
@Component
public class TrainingAuditAccess {
    private final TrainingActivityService activities;
    private final TrainingMatrixService matrices;
    private final TrainingAssessmentLibraryService assessments;
    private final TrainingJobAssignmentService jobs;
    private final TrainingPersonnelReviewService reviews;
    private final TrainingRequirementService requirements;
    private final TrainingSpecimenService specimens;

    public TrainingAuditAccess(TrainingActivityService activities, TrainingMatrixService matrices, TrainingAssessmentLibraryService assessments, TrainingJobAssignmentService jobs,
                               TrainingPersonnelReviewService reviews, TrainingRequirementService requirements, TrainingSpecimenService specimens) {
        this.activities = activities;
        this.matrices = matrices;
        this.assessments = assessments;
        this.jobs = jobs;
        this.reviews = reviews;
        this.requirements = requirements;
        this.specimens = specimens;
    }

    /** True when the module is one of the Training records that have a detail screen; the read of the record throws when the person may not open it. */
    @Transactional(readOnly = true)
    public boolean require(UserAccount actor, String module, UUID id) {
        String type = module == null ? "" : module.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        switch (type) {
            case "TRAINING_ACTIVITY" -> activities.get(actor, id);
            case "TRAINING_MATRIX", "TRAINING_MATRIX_VERSION" -> matrices.version(actor, id);
            case "TRAINING_ASSESSMENT" -> assessments.get(actor, id);
            case "TRAINING_JOB_ASSIGNMENT" -> jobs.get(actor, id);
            case "TRAINING_PERSONNEL_REVIEW" -> reviews.get(actor, id);
            case "TRAINING_REQUIREMENT" -> requirements.get(actor, id);
            case "TRAINING_SPECIMEN_SIGNATURE" -> specimens.get(actor, id);
            default -> { return false; }
        }
        return true;
    }
}
