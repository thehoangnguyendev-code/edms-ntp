package com.eqms.service.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.dto.document.WorkflowProgressResponse;
import org.junit.jupiter.api.Test;

/** The stepper of a report template revision is worked out on the server; these pin what the screens drew before the move. */
class ReportRevisionWorkflowTest {

    private static boolean ended(WorkflowProgressResponse p) {
        return p.steps().get(p.currentStepIndex()).terminal();
    }

    @Test
    void stepsAndTheStepOfEachStatus() {
        assertThat(ReportRevisionWorkflow.of("DRAFT").steps()).extracting(s -> s.label())
                .containsExactly("Draft", "Pending Approval", "Effective", "Obsoleted", "Closed - Cancelled");
        assertThat(ReportRevisionWorkflow.of(null).currentStepIndex()).isZero();
        assertThat(ReportRevisionWorkflow.of("DRAFT").currentStepIndex()).isZero();
        assertThat(ReportRevisionWorkflow.of("PENDING_APPROVAL").currentStepIndex()).isEqualTo(1);
        assertThat(ReportRevisionWorkflow.of("APPROVED").currentStepIndex()).isEqualTo(2);
        assertThat(ReportRevisionWorkflow.of("EFFECTIVE").currentStepIndex()).isEqualTo(2);
        assertThat(ended(ReportRevisionWorkflow.of("EFFECTIVE"))).isFalse();
        assertThat(ReportRevisionWorkflow.of("SOMETHING_ELSE").currentStepIndex()).isZero();
    }

    @Test
    void anEndedRevisionReportsWhereItStood() {
        WorkflowProgressResponse obsolete = ReportRevisionWorkflow.of("OBSOLETE");
        assertThat(obsolete.currentStepIndex()).isEqualTo(3);
        assertThat(ended(obsolete)).isTrue();
        assertThat(obsolete.terminalProgressStep()).isEqualTo("Effective");

        WorkflowProgressResponse discarded = ReportRevisionWorkflow.of("DISCARDED");
        assertThat(discarded.currentStepIndex()).isEqualTo(4);
        assertThat(ended(discarded)).isTrue();
        assertThat(discarded.terminalProgressStep()).isEqualTo("Draft");
    }

    @Test
    void aTemplateShowsTheRevisionBeingWrittenElseTheEffectiveOneElseItsApprovalStatus() {
        assertThat(ReportRevisionWorkflow.ofTemplate(3, "PENDING_APPROVAL", 2, "APPROVED").currentStepIndex()).isEqualTo(1);
        assertThat(ReportRevisionWorkflow.ofTemplate(null, null, 2, "DRAFT").currentStepIndex()).isEqualTo(2);
        assertThat(ReportRevisionWorkflow.ofTemplate(null, null, null, "PENDING_APPROVAL").currentStepIndex()).isEqualTo(1);
        assertThat(ReportRevisionWorkflow.ofTemplate(null, null, null, null).currentStepIndex()).isZero();
        // an open revision without a status falls through to the effective one, as the screen did
        assertThat(ReportRevisionWorkflow.ofTemplate(3, null, 2, "DRAFT").currentStepIndex()).isEqualTo(2);
    }
}
