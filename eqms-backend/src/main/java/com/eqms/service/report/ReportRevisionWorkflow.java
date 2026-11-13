package com.eqms.service.report;

import com.eqms.dto.document.WorkflowProgressResponse;
import com.eqms.dto.document.WorkflowProgressResponse.WorkflowStepResponse;

import java.util.List;
import java.util.Map;

/**
 * The lifecycle stepper of a report template revision (REPORT-TEMPLATE-REVISION-2026-10-14), worked out on the server:
 * Draft, Pending Approval, Effective, Obsoleted; a revision that was discarded ends at Closed - Cancelled. Read-only.
 */
public final class ReportRevisionWorkflow {

    private static final List<WorkflowStepResponse> STEPS = List.of(
            new WorkflowStepResponse("DRAFT", "Draft", false),
            new WorkflowStepResponse("PENDING_APPROVAL", "Pending Approval", false),
            new WorkflowStepResponse("EFFECTIVE", "Effective", false),
            new WorkflowStepResponse("OBSOLETE", "Obsoleted", true),
            new WorkflowStepResponse("DISCARDED", "Closed - Cancelled", true));

    /** The step of each status. APPROVED is the approval status of a template that was never revised; it stands at Effective. */
    private static final Map<String, Integer> STEP_OF =
            Map.of("DRAFT", 0, "PENDING_APPROVAL", 1, "APPROVED", 2, "EFFECTIVE", 2, "OBSOLETE", 3, "DISCARDED", 4);

    private ReportRevisionWorkflow() {
    }

    /** The status is the machine status of the revision, or the approval status of a template that was never approved; none is a draft. */
    public static WorkflowProgressResponse of(Object status) {
        String key = status == null ? "DRAFT" : String.valueOf(status);
        // Where an obsoleted or discarded revision stood before it ended, so that the steps before are shown as done.
        String reached = "OBSOLETE".equals(key) ? "Effective" : "DISCARDED".equals(key) ? "Draft" : "";
        return new WorkflowProgressResponse(STEPS, STEP_OF.getOrDefault(key, 0), List.of(), reached);
    }

    /** The revision that matters on the screens of a template: the one being written, else the effective one, else the approval status of the template. */
    public static WorkflowProgressResponse ofTemplate(Object openRevision, Object openRevisionStatus, Object effectiveRevision, Object approvalStatus) {
        if (openRevision != null && openRevisionStatus != null && !String.valueOf(openRevisionStatus).isEmpty()) return of(openRevisionStatus);
        if (effectiveRevision != null) return of("EFFECTIVE");
        return of(approvalStatus);
    }
}
