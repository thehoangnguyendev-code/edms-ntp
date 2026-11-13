package com.eqms.dto.document;

import com.eqms.dto.document.WorkflowProgressResponse.WorkflowStepResponse;

import java.util.List;

/** The Revision and Document lifecycles in order, for screens that draw a stepper before a record exists. */
public record WorkflowStepsResponse(
        List<WorkflowStepResponse> revision,
        List<WorkflowStepResponse> document,
        /** Labels of the Revision steps that never run for a Legacy Import: its history was reviewed and approved outside the system. */
        List<String> legacyImportSkippedSteps
) {
}
