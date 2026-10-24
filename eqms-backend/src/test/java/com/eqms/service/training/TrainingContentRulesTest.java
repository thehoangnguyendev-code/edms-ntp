package com.eqms.service.training;

import com.eqms.service.training.TrainingContentRules.Facts;
import com.eqms.service.training.TrainingContentRules.Result;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** One test for each case of PLAN-TR-002: when Training Materials and an Assessment form are needed before the activity goes on. */
class TrainingContentRulesTest {

    private static Facts facts(String kind, String reason, boolean supplementary, boolean documentLinked, int content, int forms, List<String> assessments) {
        return new Facts(kind, reason, supplementary, documentLinked, content, forms, 0, assessments, false, false);
    }

    @Test
    void aTrainingFromADocumentUsesTheDocumentAsItsMaterialAndStillNeedsTheTestOfAClassroomSession() {
        Result noTest = TrainingContentRules.evaluate(facts("UNPLANNED", "NEW_SOP", false, true, 0, 0, List.of("TEST")));
        assertThat(noTest.materialsSatisfied()).isTrue();
        assertThat(noTest.materialsSource()).isEqualTo("DOCUMENT");
        assertThat(noTest.missing()).containsExactly(TrainingContentRules.TEST_REQUIRED);

        assertThat(TrainingContentRules.evaluate(facts("UNPLANNED", "NEW_SOP", false, true, 0, 1, List.of("TEST"))).complete()).isTrue();
    }

    @Test
    void aSelfReadingTrainingOfADocumentNeedsNothingMore() {
        Result r = TrainingContentRules.evaluate(facts("PERIODIC", "SOP_VERSION", false, true, 0, 0, List.of("SELF_READING_CONFIRMATION")));
        assertThat(r.complete()).isTrue();
        assertThat(r.testRequired()).isFalse();
    }

    @Test
    void aStandardTopicWithoutADocumentNeedsAFileOrALinkAndATestForAClassroomSession() {
        Result r = TrainingContentRules.evaluate(facts("PERIODIC", "OTHER", false, false, 0, 0, List.of("TEST")));
        assertThat(r.missing()).containsExactly(TrainingContentRules.MATERIALS_REQUIRED, TrainingContentRules.TEST_REQUIRED);

        assertThat(TrainingContentRules.evaluate(facts("PERIODIC", "OTHER", false, false, 1, 1, List.of("TEST"))).complete()).isTrue();
    }

    @Test
    void aPracticalSessionWithAChecklistNeedsTheChecklistFormAndNotATest() {
        Result r = TrainingContentRules.evaluate(facts("UNPLANNED", "OTHER", false, false, 1, 0, List.of("CHECKLIST")));
        assertThat(r.testRequired()).isFalse();
        assertThat(r.checklistRequired()).isTrue();
        assertThat(r.missing()).containsExactly(TrainingContentRules.CHECKLIST_REQUIRED);
    }

    @Test
    void anObservationNeedsNoFile() {
        Result r = TrainingContentRules.evaluate(facts("UNPLANNED", "OTHER", false, true, 0, 0, List.of("OBSERVATION")));
        assertThat(r.complete()).isTrue();
    }

    @Test
    void aTrainingFromAChangeOrACapaNeedsAFileBecauseTheSystemDoesNotLinkThemYet() {
        Result r = TrainingContentRules.evaluate(facts("UNPLANNED", "CAPA", false, false, 0, 0, List.of("SELF_READING_CONFIRMATION")));
        assertThat(r.missing()).containsExactly(TrainingContentRules.MATERIALS_REQUIRED);
    }

    @Test
    void eachSessionOfAMultiSessionActivityCounts() {
        // a new employee: HR reads, QA tests, the department does a practical session
        Result r = TrainingContentRules.evaluate(facts("INITIAL", "NEW_HIRE", false, false, 1, 0, List.of("SELF_READING_CONFIRMATION", "TEST", "CHECKLIST")));
        assertThat(r.testRequired()).isTrue();
        assertThat(r.checklistRequired()).isTrue();
        assertThat(r.missing()).containsExactly(TrainingContentRules.TEST_REQUIRED);
    }

    @Test
    void aSupplementaryTrainingKeepsTheContentOfTheActivityItSupplements() {
        Result r = TrainingContentRules.evaluate(facts("RETRAINING", "FAILED_ASSESSMENT", true, false, 0, 0, List.of("TEST")));
        assertThat(r.complete()).isTrue();
        assertThat(r.inherited()).isTrue();
        assertThat(r.materialsRequired()).isFalse();
    }

    @Test
    void aVisitorAndAnExternalTrainingNeedNothing() {
        assertThat(TrainingContentRules.evaluate(facts("UNPLANNED", "VISITOR", false, false, 0, 0, List.of("TEST"))).complete()).isTrue();
        assertThat(TrainingContentRules.evaluate(facts("EXTERNAL", null, false, false, 0, 0, List.of())).complete()).isTrue();
    }

    @Test
    void anExemptionOfTheOrganizerLiftsTheRequirementItNames() {
        Facts base = facts("PERIODIC", "OTHER", false, false, 0, 0, List.of("TEST"));
        assertThat(TrainingContentRules.evaluate(new Facts(base.kind(), base.kindReason(), false, false, 0, 0, 0, base.sessionAssessments(), true, false)).missing())
                .containsExactly(TrainingContentRules.TEST_REQUIRED);
        assertThat(TrainingContentRules.evaluate(new Facts(base.kind(), base.kindReason(), false, false, 0, 0, 0, base.sessionAssessments(), false, true)).missing())
                .containsExactly(TrainingContentRules.MATERIALS_REQUIRED);
        assertThat(TrainingContentRules.evaluate(new Facts(base.kind(), base.kindReason(), false, false, 0, 0, 0, base.sessionAssessments(), true, true)).complete()).isTrue();
    }

    @Test
    void anActivityWithoutSessionsNeedsNoAssessmentForm() {
        assertThat(TrainingContentRules.evaluate(facts("PERIODIC", "OTHER", false, true, 0, 0, List.of())).complete()).isTrue();
    }

    @Test
    void aTestWrittenInTheSystemIsTheTestAndNeedsNoFile() {
        Result r = TrainingContentRules.evaluate(new Facts("PERIODIC", "OTHER", false, true, 0, 0, 5, List.of("TEST"), false, false));
        assertThat(r.onlineTest()).isTrue();
        assertThat(r.complete()).isTrue();
    }

    @Test
    void aChecklistIsAlwaysAFormEvenWhenTheActivityHasQuestions() {
        Result r = TrainingContentRules.evaluate(new Facts("PERIODIC", "OTHER", false, true, 0, 0, 5, List.of("CHECKLIST"), false, false));
        assertThat(r.missing()).containsExactly(TrainingContentRules.CHECKLIST_REQUIRED);
    }
}
