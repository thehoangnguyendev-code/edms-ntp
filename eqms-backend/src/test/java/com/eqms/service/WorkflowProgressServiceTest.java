package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.dto.document.WorkflowProgressResponse;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.ControlledCopyStatusDefinition;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import com.eqms.service.WorkflowProgressService.Transition;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The stepper is worked out on the server from the status lookup tables and the recorded history. */
class WorkflowProgressServiceTest {

    private WorkflowProgressService service;

    private static RevisionStatusDefinition rev(String code, String label, int order, boolean terminal) {
        RevisionStatusDefinition s = new RevisionStatusDefinition();
        s.setCode(code);
        s.setLabel(label);
        s.setSortOrder(order);
        s.setTerminal(terminal);
        return s;
    }

    private static DocumentStatusDefinition doc(String code, String label, int order, boolean terminal) {
        DocumentStatusDefinition s = new DocumentStatusDefinition();
        s.setCode(code);
        s.setLabel(label);
        s.setSortOrder(order);
        s.setTerminal(terminal);
        return s;
    }

    private static ControlledCopyStatusDefinition copy(String code, String label, int order, boolean terminal) {
        ControlledCopyStatusDefinition s = new ControlledCopyStatusDefinition();
        s.setCode(code);
        s.setLabel(label);
        s.setSortOrder(order);
        s.setTerminal(terminal);
        return s;
    }

    @BeforeEach
    void setUp() {
        RevisionStatusDefinitionRepository revisions = mock(RevisionStatusDefinitionRepository.class);
        DocumentStatusDefinitionRepository documents = mock(DocumentStatusDefinitionRepository.class);
        when(revisions.findAllByOrderBySortOrderAsc()).thenReturn(List.of(
                rev("DRAFT", "Draft", 1, false),
                rev("PENDING_REVIEW", "Pending Review", 2, false),
                rev("PENDING_APPROVAL", "Pending Approval", 3, false),
                rev("PENDING_TRAINING", "Pending Training", 4, false),
                rev("READY_FOR_PUBLISHING", "Ready for Publishing", 5, false),
                rev("EFFECTIVE", "Effective", 6, false),
                rev("OBSOLETED", "Obsoleted", 7, true),
                rev("CLOSED_CANCELLED", "Closed - Cancelled", 8, true)));
        when(documents.findAllByOrderBySortOrderAsc()).thenReturn(List.of(
                doc("DRAFT", "Draft", 1, false),
                doc("ACTIVE", "Active", 2, false),
                doc("OBSOLETED", "Obsoleted", 3, true),
                doc("CLOSED_CANCELLED", "Closed - Cancelled", 4, true)));
        ControlledCopyStatusDefinitionRepository copies = mock(ControlledCopyStatusDefinitionRepository.class);
        when(copies.findAllByOrderBySortOrderAsc()).thenReturn(List.of(
                copy("READY_FOR_DISTRIBUTION", "Ready for Distribution", 1, false),
                copy("DISTRIBUTED", "Distributed", 2, false),
                copy("OBSOLETED", "Obsoleted", 3, true),
                copy("CLOSED_CANCELLED", "Closed - Cancelled", 4, true)));
        service = new WorkflowProgressService(revisions, documents, mock(AuditLogRepository.class), copies);
    }

    @Test
    void stepsFollowTheLookupOrder() {
        WorkflowProgressResponse p = service.forRevision("PENDING_APPROVAL", true, List.of());
        assertThat(p.steps()).extracting(s -> s.code()).containsExactly(
                "DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING",
                "READY_FOR_PUBLISHING", "EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED");
        assertThat(p.currentStepIndex()).isEqualTo(2);
        assertThat(p.skippedSteps()).isEmpty();
        assertThat(p.terminalProgressStep()).isEmpty();
    }

    @Test
    void trainingNotRequiredSkipsThatStepEvenWithoutHistory() {
        WorkflowProgressResponse p = service.forRevision("DRAFT", false, List.of());
        assertThat(p.skippedSteps()).containsExactly("Pending Training");
    }

    @Test
    void aStepNeverVisitedBeforeTheCurrentOneIsSkipped() {
        List<Transition> history = List.of(
                new Transition("SUBMIT", "DRAFT", "PENDING_REVIEW"),
                new Transition("REVIEW", "PENDING_REVIEW", "PENDING_APPROVAL"),
                new Transition("APPROVE", "PENDING_APPROVAL", "READY_FOR_PUBLISHING"));
        WorkflowProgressResponse p = service.forRevision("READY_FOR_PUBLISHING", false, history);
        assertThat(p.currentStepIndex()).isEqualTo(4);
        assertThat(p.skippedSteps()).containsExactly("Pending Training");
    }

    @Test
    void reviewIsMarkedSkippedWhenHistoryGoesStraightToApproval() {
        WorkflowProgressResponse p = service.forRevision("PENDING_APPROVAL", true, List.of(
                new Transition("SUBMIT", "DRAFT", "PENDING_APPROVAL")));
        assertThat(p.skippedSteps()).containsExactly("Pending Review");
    }

    @Test
    void reviewIsNotMarkedSkippedWhenTheStageWasVisited() {
        WorkflowProgressResponse p = service.forRevision("PENDING_APPROVAL", true, List.of(
                new Transition("SUBMIT", "DRAFT", "PENDING_REVIEW"),
                new Transition("REVIEW", "PENDING_REVIEW", "PENDING_APPROVAL")));
        assertThat(p.skippedSteps()).doesNotContain("Pending Review");
    }

    @Test
    void aRevisionCancelledInReviewReportsWhereItEndedAndDoesNotPretendLaterStepsHappened() {
        List<Transition> history = List.of(
                new Transition("SUBMIT", "DRAFT", "PENDING_REVIEW"),
                new Transition("CANCEL", "PENDING_REVIEW", "CLOSED_CANCELLED"));
        WorkflowProgressResponse p = service.forRevision("CLOSED_CANCELLED", true, history);
        assertThat(p.currentStepIndex()).isEqualTo(7);
        assertThat(p.terminalProgressStep()).isEqualTo("Pending Review");
        assertThat(p.skippedSteps()).isEmpty();
    }

    @Test
    void aSideEffectRowWithoutAFromStatusIsNotTheEndingMove() {
        List<Transition> history = List.of(
                new Transition("SUBMIT", "DRAFT", "PENDING_REVIEW"),
                new Transition("CANCEL", "PENDING_REVIEW", "CLOSED_CANCELLED"),
                new Transition("UPLOAD_EVIDENCE", null, "CLOSED_CANCELLED"));
        WorkflowProgressResponse p = service.forRevision("CLOSED_CANCELLED", true, history);
        assertThat(p.terminalProgressStep()).isEqualTo("Pending Review");
    }

    @Test
    void olderRowsHoldingLabelsOrLegacyCodesAreUnderstood() {
        List<Transition> history = List.of(
                new Transition("SUBMIT", "Draft", "Pending Review"),
                new Transition("CANCEL", "Pending Review", "REJECTED"));
        WorkflowProgressResponse p = service.forRevision("CLOSED_CANCELLED", true, history);
        assertThat(p.terminalProgressStep()).isEqualTo("Pending Review");
    }

    @Test
    void anUnknownStatusFallsBackToTheFirstStep() {
        WorkflowProgressResponse p = service.forRevision("SOMETHING_ELSE", true, List.of());
        assertThat(p.currentStepIndex()).isZero();
        assertThat(p.skippedSteps()).isEmpty();
    }

    @Test
    void uncontrolledCopyPhasesFollowTheServerRule() {
        assertThat(service.forUncontrolledCopy("READY_FOR_DISTRIBUTION").currentStepIndex()).isZero();
        assertThat(service.forUncontrolledCopy("DISTRIBUTED").currentStepIndex()).isEqualTo(1);
        WorkflowProgressResponse rejected = service.forUncontrolledCopy("CLOSED_CANCELLED");
        assertThat(rejected.steps()).extracting(s -> s.code())
                .containsExactly("READY_FOR_DISTRIBUTION", "DISTRIBUTED", "CLOSED_CANCELLED");
        assertThat(rejected.currentStepIndex()).isEqualTo(2);
        assertThat(rejected.terminalProgressStep()).isEqualTo("Ready for Distribution");
        assertThat(service.forUncontrolledCopy("DISTRIBUTED").terminalProgressStep()).isEmpty();
    }

    @Test
    void controlledCopyReportsWhereItEndedWithoutInventingSkippedSteps() {
        WorkflowProgressResponse p = service.forControlledCopy("OBSOLETED", null);
        assertThat(p.steps()).hasSize(4);
        assertThat(p.currentStepIndex()).isEqualTo(2);
        assertThat(p.skippedSteps()).isEmpty();
    }

    @Test
    void documentStepsComeFromTheDocumentLookup() {
        WorkflowProgressResponse p = service.forDocument("ACTIVE", null);
        assertThat(p.steps()).extracting(s -> s.code()).containsExactly("DRAFT", "ACTIVE", "OBSOLETED", "CLOSED_CANCELLED");
        assertThat(p.currentStepIndex()).isEqualTo(1);
        assertThat(p.skippedSteps()).isEmpty();
    }
}
