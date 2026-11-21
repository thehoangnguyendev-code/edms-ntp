package com.eqms.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/** The status a policy list shows is words a person reads, never the code that the server keeps. */
class WorkflowActionPolicyStatusLabelTest {

    @Test
    void trainingActivityStatusesUseTheWordsOfTheTrainingScreens() {
        assertEquals("Planned", WorkflowActionPolicyService.Labels.status("PLANNED"));
        assertEquals("Notified", WorkflowActionPolicyService.Labels.status("NOTIFIED"));
        assertEquals("In Progress", WorkflowActionPolicyService.Labels.status("IN_PROGRESS"));
        assertEquals("Pending QA Confirmation", WorkflowActionPolicyService.Labels.status("PENDING_QA_CONFIRMATION"));
    }

    @Test
    void aStatusWithoutALabelOfItsOwnIsStillShownAsWords() {
        assertEquals("Open", WorkflowActionPolicyService.Labels.status("OPEN"));
        assertEquals("Pending", WorkflowActionPolicyService.Labels.status("PENDING"));
        assertNotEquals("SOME_FUTURE_STATUS", WorkflowActionPolicyService.Labels.status("SOME_FUTURE_STATUS"));
        assertEquals("Some Future Status", WorkflowActionPolicyService.Labels.status("SOME_FUTURE_STATUS"));
    }

    @Test
    void theDocumentStatusesKeepTheirLabels() {
        assertEquals("Pending Approval", WorkflowActionPolicyService.Labels.status("PENDING_APPROVAL"));
        assertEquals("Closed - Cancelled", WorkflowActionPolicyService.Labels.status("CLOSED_CANCELLED"));
    }
}
