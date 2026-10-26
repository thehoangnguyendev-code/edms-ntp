package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The revision of a Training Assessment is numbered as the revision of a document: 0.0.1 -> 1.0.0, then 1.0.1 -> 2.0.0. */
class TrainingAssessmentRevisionTest {

    @Test
    void approvingADraftMakesTheNextMajor() {
        assertThat(TrainingAssessmentLibraryService.approvedRevision("0.0.1")).isEqualTo("1.0.0");
        assertThat(TrainingAssessmentLibraryService.approvedRevision("1.0.1")).isEqualTo("2.0.0");
        assertThat(TrainingAssessmentLibraryService.approvedRevision("9.0.1")).isEqualTo("10.0.0");
    }

    @Test
    void aNewDraftOfAnEffectiveRevisionKeepsItsMajorAndStartsAtPatchOne() {
        assertThat(TrainingAssessmentLibraryService.nextDraftRevision("1.0.0")).isEqualTo("1.0.1");
        assertThat(TrainingAssessmentLibraryService.nextDraftRevision("2.0.0")).isEqualTo("2.0.1");
    }

    @Test
    void theWholeLifeOfAnAssessmentFollowsTheDocumentNumbering() {
        String draft = "0.0.1";
        String effective = TrainingAssessmentLibraryService.approvedRevision(draft);
        String second = TrainingAssessmentLibraryService.nextDraftRevision(effective);
        assertThat(effective).isEqualTo("1.0.0");
        assertThat(second).isEqualTo("1.0.1");
        assertThat(TrainingAssessmentLibraryService.approvedRevision(second)).isEqualTo("2.0.0");
    }

    @Test
    void aMalformedRevisionIsRefusedRatherThanGuessed() {
        assertThatThrownBy(() -> TrainingAssessmentLibraryService.approvedRevision("abc")).isInstanceOf(IllegalStateException.class).hasMessage("TRAINING_ASSESSMENT_REVISION_INVALID");
    }
}
