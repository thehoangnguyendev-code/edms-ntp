package com.eqms.service;

import com.eqms.dto.document.WorkflowProgressResponse;
import com.eqms.dto.document.WorkflowProgressResponse.WorkflowStepResponse;

import java.util.List;

/**
 * The stages a backup goes through, worked out on the server from its machine status and verification; the screen only
 * draws them. A failed backup stops at "Failed"; any other one runs, completes, and is verified by its integrity check.
 */
public final class BackupWorkflow {

    private static final List<WorkflowStepResponse> FAILED = List.of(
            new WorkflowStepResponse("RUNNING", "Running", false),
            new WorkflowStepResponse("FAILED", "Failed", false));
    private static final List<WorkflowStepResponse> STAGES = List.of(
            new WorkflowStepResponse("RUNNING", "Running", false),
            new WorkflowStepResponse("COMPLETED", "Completed", false),
            new WorkflowStepResponse("VERIFIED", "Verified", false));

    private BackupWorkflow() {
    }

    public static WorkflowProgressResponse of(String status, String verification) {
        if ("FAILED".equals(status)) return new WorkflowProgressResponse(FAILED, 1, List.of(), "");
        int current = "RUNNING".equals(status) ? 0 : "VERIFIED".equals(verification) ? 2 : 1;
        return new WorkflowProgressResponse(STAGES, current, List.of(), "");
    }
}
