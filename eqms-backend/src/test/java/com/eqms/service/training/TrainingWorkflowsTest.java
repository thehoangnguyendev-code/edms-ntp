package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.dto.document.WorkflowProgressResponse;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The steppers of the Training records are worked out on the server; these pin what each screen drew before the move. */
class TrainingWorkflowsTest {

    private static List<String> labels(WorkflowProgressResponse p) {
        return p.steps().stream().map(s -> s.label()).toList();
    }

    private static boolean ended(WorkflowProgressResponse p) {
        return p.steps().get(p.currentStepIndex()).terminal();
    }

    // ---- activity ----

    @Test
    void runningActivityShowsItsOwnStep() {
        WorkflowProgressResponse p = TrainingWorkflows.activity("IN_PROGRESS", null);
        // "Closed - Cancelled" is always the last step, as for a Document and a Revision; the activity is on it only once it is cancelled
        assertThat(labels(p)).containsExactly("Pending Document Approval", "Planned", "Pending Approval", "Notified", "In Progress", "Pending QA Confirmation", "Completed", "Closed - Cancelled");
        assertThat(p.currentStepIndex()).isEqualTo(4);
        assertThat(ended(p)).isFalse();
        assertThat(p.terminalProgressStep()).isEmpty();
        assertThat(TrainingWorkflows.activity("COMPLETED", null).currentStepIndex()).isEqualTo(6);
        assertThat(ended(TrainingWorkflows.activity("COMPLETED", null))).isFalse();
    }

    @Test
    void cancelledActivityEndsAtTheClosedStepAndReportsWhereItStopped() {
        WorkflowProgressResponse p = TrainingWorkflows.activity("CANCELLED", "NOTIFIED");
        assertThat(p.steps()).hasSize(8);
        assertThat(labels(p).get(7)).isEqualTo("Closed - Cancelled");
        assertThat(p.currentStepIndex()).isEqualTo(7);
        assertThat(ended(p)).isTrue();
        // the steps up to the one it was cancelled from were gone through; those between it and the ending were not (the stepper stripes them)
        assertThat(p.terminalProgressStep()).isEqualTo("Notified");
        assertThat(p.skippedSteps()).isEmpty();
    }

    @Test
    void anActivityCancelledWhereTheOriginIsNotKnownTicksNothingBeyondTheFirstStep() {
        assertThat(TrainingWorkflows.activity("CANCELLED", null).terminalProgressStep()).isEmpty();
        assertThat(TrainingWorkflows.activity("CANCELLED", "SOMETHING_ELSE").terminalProgressStep()).isEmpty();
        // an activity cancelled while it was still Planned has not reached Pending Approval, Notified... : those are between the origin and the ending
        WorkflowProgressResponse planned = TrainingWorkflows.activity("CANCELLED", "PLANNED");
        assertThat(planned.terminalProgressStep()).isEqualTo("Planned");
        assertThat(planned.currentStepIndex()).isEqualTo(7);
    }

    @Test
    void newActivityStartsAtNew() {
        WorkflowProgressResponse p = TrainingWorkflows.newActivity();
        assertThat(labels(p)).containsExactly("New", "Planned", "Pending Approval", "Notified", "In Progress", "Pending QA Confirmation", "Completed", "Closed - Cancelled");
        assertThat(p.currentStepIndex()).isZero();
        assertThat(ended(p)).isFalse();
    }

    // ---- assessment ----

    @Test
    void assessmentFollowsItsStatusAndAnObsoletedOneWasEffective() {
        assertThat(labels(TrainingWorkflows.assessment("DRAFT"))).containsExactly("Draft", "Pending Approval", "Effective", "Obsoleted");
        assertThat(TrainingWorkflows.assessment(null).currentStepIndex()).isZero();
        assertThat(TrainingWorkflows.assessment("PENDING_APPROVAL").currentStepIndex()).isEqualTo(1);
        assertThat(TrainingWorkflows.assessment("EFFECTIVE").currentStepIndex()).isEqualTo(2);
        assertThat(ended(TrainingWorkflows.assessment("EFFECTIVE"))).isFalse();
        WorkflowProgressResponse obsoleted = TrainingWorkflows.assessment("OBSOLETED");
        assertThat(obsoleted.currentStepIndex()).isEqualTo(3);
        assertThat(ended(obsoleted)).isTrue();
        assertThat(obsoleted.terminalProgressStep()).isEqualTo("Effective");
    }

    // ---- job assignment ----

    @Test
    void jobEndsCancelledFromDraftOrObsoletedFromEffective() {
        WorkflowProgressResponse running = TrainingWorkflows.job("PENDING_RECEIVER");
        assertThat(labels(running)).containsExactly("Draft", "Pending Employee Acceptance", "Effective", "Obsoleted");
        assertThat(running.currentStepIndex()).isEqualTo(1);
        assertThat(ended(running)).isFalse();
        assertThat(TrainingWorkflows.job("EFFECTIVE").currentStepIndex()).isEqualTo(2);

        WorkflowProgressResponse cancelled = TrainingWorkflows.job("CANCELLED");
        assertThat(labels(cancelled)).containsExactly("Draft", "Pending Employee Acceptance", "Effective", "Cancelled");
        assertThat(cancelled.currentStepIndex()).isEqualTo(3);
        assertThat(ended(cancelled)).isTrue();
        assertThat(cancelled.terminalProgressStep()).isEqualTo("Draft");

        WorkflowProgressResponse obsoleted = TrainingWorkflows.job("OBSOLETED");
        assertThat(obsoleted.currentStepIndex()).isEqualTo(3);
        assertThat(ended(obsoleted)).isTrue();
        assertThat(obsoleted.terminalProgressStep()).isEqualTo("Effective");
    }

    // ---- matrix version ----

    @Test
    void matrixVersionFollowsItsStatus() {
        assertThat(labels(TrainingWorkflows.matrixVersion("DRAFT"))).containsExactly("Draft", "Pending Approval", "Effective", "Obsoleted");
        assertThat(TrainingWorkflows.matrixVersion("EFFECTIVE").currentStepIndex()).isEqualTo(2);
        WorkflowProgressResponse obsoleted = TrainingWorkflows.matrixVersion("OBSOLETED");
        assertThat(obsoleted.currentStepIndex()).isEqualTo(3);
        assertThat(ended(obsoleted)).isTrue();
        assertThat(obsoleted.terminalProgressStep()).isEqualTo("Effective");
    }

    // ---- personnel review ----

    @Test
    void reviewEndsClosedOrCancelled() {
        WorkflowProgressResponse open = TrainingWorkflows.personnelReview("OPEN");
        assertThat(labels(open)).containsExactly("Open", "Closed", "Cancelled");
        assertThat(open.currentStepIndex()).isZero();
        assertThat(open.skippedSteps()).isEmpty();

        WorkflowProgressResponse closed = TrainingWorkflows.personnelReview("CLOSED");
        assertThat(closed.currentStepIndex()).isEqualTo(1);
        assertThat(ended(closed)).isFalse();
        assertThat(closed.skippedSteps()).containsExactly("Cancelled");

        WorkflowProgressResponse cancelled = TrainingWorkflows.personnelReview("CANCELLED");
        assertThat(cancelled.currentStepIndex()).isEqualTo(2);
        assertThat(ended(cancelled)).isTrue();
        assertThat(cancelled.terminalProgressStep()).isEqualTo("Open");
        assertThat(cancelled.skippedSteps()).isEmpty();
    }

    // ---- requirement, specimen ----

    @Test
    void requirementFollowsItsStatus() {
        assertThat(labels(TrainingWorkflows.requirement("DRAFT"))).containsExactly("Draft", "Pending Review", "Pending Approval", "Approved");
        assertThat(TrainingWorkflows.requirement("PENDING_REVIEW").currentStepIndex()).isEqualTo(1);
        assertThat(TrainingWorkflows.requirement("PENDING_APPROVAL").currentStepIndex()).isEqualTo(2);
        assertThat(TrainingWorkflows.requirement("APPROVED").currentStepIndex()).isEqualTo(3);
        assertThat(ended(TrainingWorkflows.requirement("APPROVED"))).isFalse();
    }

    @Test
    void specimenIsCurrentUntilItIsSuperseded() {
        assertThat(labels(TrainingWorkflows.specimen("APPROVED"))).containsExactly("Current", "Superseded");
        assertThat(TrainingWorkflows.specimen("PENDING_CONFIRMATION").currentStepIndex()).isZero();
        assertThat(TrainingWorkflows.specimen("APPROVED").currentStepIndex()).isZero();
        WorkflowProgressResponse superseded = TrainingWorkflows.specimen("OBSOLETED");
        assertThat(superseded.currentStepIndex()).isEqualTo(1);
        assertThat(ended(superseded)).isFalse();
    }
}
