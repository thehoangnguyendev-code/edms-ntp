package com.eqms.dto.document;

import java.util.List;

/**
 * What a lifecycle stepper shows for one Document or Revision, worked out on the server from the status
 * lookup tables (order comes from {@code sort_order}) and the recorded history. The client only draws it.
 *
 * @param steps               the lifecycle in order
 * @param currentStepIndex    index into {@code steps} of the current status; 0 when it is not one of the steps
 * @param skippedSteps        labels of steps this record never went through
 * @param terminalProgressStep label of the step the record had reached when it ended (cancelled / obsoleted);
 *                             empty while the record is still running or when the history does not say
 */
public record WorkflowProgressResponse(
        List<WorkflowStepResponse> steps,
        int currentStepIndex,
        List<String> skippedSteps,
        String terminalProgressStep
) {

    public record WorkflowStepResponse(String code, String label, boolean terminal) {
    }
}
