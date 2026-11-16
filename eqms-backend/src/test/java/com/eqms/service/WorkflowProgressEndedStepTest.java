package com.eqms.service;

import com.eqms.dto.document.WorkflowProgressResponse.WorkflowStepResponse;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.doReturn;

/**
 * A stepper of an ended record shows where it had got to when it ended. Rows that are not a move (an opened screen logs "from = to") and moves out of an ending
 * status must not be taken for that point: a Document cancelled in Draft and then opened was drawn as if it had been Active and Obsoleted.
 */
class WorkflowProgressEndedStepTest {
    private static List<WorkflowStepResponse> documentSteps() {
        return List.of(new WorkflowStepResponse("DRAFT", "Draft", false), new WorkflowStepResponse("ACTIVE", "Active", false),
                new WorkflowStepResponse("OBSOLETED", "Obsoleted", true), new WorkflowStepResponse("CLOSED_CANCELLED", "Closed - Cancelled", true));
    }

    private static WorkflowProgressService.Transition move(String action, String from, String to) {
        return new WorkflowProgressService.Transition(action, from, to);
    }

    private String reached(String status, List<WorkflowProgressService.Transition> history) {
        // forDocument reads the audit trail; the shared builder is what decides, so it is reached through the revision entry with the same step list
        return buildFor(status, history);
    }

    private String buildFor(String status, List<WorkflowProgressService.Transition> history) {
        var service = spy(new WorkflowProgressService(mock(RevisionStatusDefinitionRepository.class), mock(DocumentStatusDefinitionRepository.class),
                mock(AuditLogRepository.class), mock(ControlledCopyStatusDefinitionRepository.class)));
        doReturn(documentSteps()).when(service).revisionSteps();
        return service.forRevision(status, true, history).terminalProgressStep();
    }

    @Test
    void aRecordCancelledInDraftThenOpenedHadReachedDraft() {
        assertEquals("Draft", reached("CLOSED_CANCELLED", List.of(move("CREATE", null, "DRAFT"), move("CANCEL", "DRAFT", "CLOSED_CANCELLED"),
                move("VIEW", "CLOSED_CANCELLED", "CLOSED_CANCELLED"), move("VIEW", "CLOSED_CANCELLED", "CLOSED_CANCELLED"))));
    }

    @Test
    void aRecordObsoletedFromActiveThenOpenedHadReachedActive() {
        assertEquals("Active", reached("OBSOLETED", List.of(move("CREATE", null, "DRAFT"), move("OBSOLETE", "ACTIVE", "OBSOLETED"), move("VIEW", "OBSOLETED", "OBSOLETED"))));
    }

    @Test
    void aMoveOutOfAnEndingStatusIsNotTheEnding() {
        // the only move into the present ending starts from an ending status: it says nothing of the path, and the earlier move was into another ending
        assertEquals("", reached("CLOSED_CANCELLED", List.of(move("OBSOLETE", "ACTIVE", "OBSOLETED"), move("OBSOLETE", "OBSOLETED", "CLOSED_CANCELLED"))));
    }

    @Test
    void anEndingNotLedToByAnyRecordedMoveIsNotDrawnFromAnotherEnding() {
        // Effective > Obsoleted is recorded; the record is now Closed - Cancelled with no move into it (set directly in the data): no path is claimed.
        assertEquals("", reached("CLOSED_CANCELLED", List.of(move("OBSOLETE", "EFFECTIVE", "OBSOLETED"))));
    }

    @Test
    void theLastMoveIntoTheCurrentEndingWinsAfterAReopen() {
        assertEquals("Active", reached("CLOSED_CANCELLED", List.of(move("CANCEL", "DRAFT", "CLOSED_CANCELLED"), move("REOPEN", "CLOSED_CANCELLED", "DRAFT"),
                move("ACTIVATE", "DRAFT", "ACTIVE"), move("CANCEL", "ACTIVE", "CLOSED_CANCELLED"))));
    }

    @Test
    void withoutAnyRealMoveNothingIsSaidToHaveBeenReached() {
        assertEquals("", reached("CLOSED_CANCELLED", List.of(move("VIEW", "CLOSED_CANCELLED", "CLOSED_CANCELLED"))));
    }
}
