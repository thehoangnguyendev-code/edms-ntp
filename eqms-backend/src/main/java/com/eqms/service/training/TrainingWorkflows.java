package com.eqms.service.training;

import com.eqms.dto.document.WorkflowProgressResponse;
import com.eqms.dto.document.WorkflowProgressResponse.WorkflowStepResponse;

import java.util.ArrayList;
import java.util.List;

/**
 * The lifecycle steppers of the Training records, worked out on the server from the machine status of the record.
 * The client holds no list of steps and no rule of its own: it draws what it is given. Read-only.
 */
public final class TrainingWorkflows {

    private TrainingWorkflows() {
    }

    private static WorkflowStepResponse step(String code, String label) {
        return new WorkflowStepResponse(code, label, false);
    }

    private static WorkflowStepResponse end(String code, String label) {
        return new WorkflowStepResponse(code, label, true);
    }

    /** Index of the step whose code is the status; the first step when none is (a status the lifecycle does not know). */
    private static int indexOf(List<WorkflowStepResponse> steps, String status) {
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).code().equals(status)) return i;
        }
        return 0;
    }

    private static WorkflowProgressResponse running(List<WorkflowStepResponse> steps, int current) {
        return new WorkflowProgressResponse(steps, current, List.of(), "");
    }

    // ---- Training Activity ----

    private static final List<WorkflowStepResponse> ACTIVITY = List.of(
            step("RESERVED", "Pending Document Approval"),
            step("PLANNED", "Planned"),
            step("PENDING_APPROVAL", "Pending Approval"),
            step("NOTIFIED", "Notified"),
            step("IN_PROGRESS", "In Progress"),
            step("PENDING_QA_CONFIRMATION", "Pending QA Confirmation"),
            step("COMPLETED", "Completed"),
            end("CANCELLED", "Closed - Cancelled"));

    /**
     * "Closed - Cancelled" is always the last step, as for a Document and a Revision, and the stepper moves to it only when the activity is cancelled. It reports the step the activity was
     * cancelled from: the steps up to it were gone through, the steps between it and the ending were not (the stepper stripes them), and when the step is not known nothing is ticked beyond the first.
     */
    public static WorkflowProgressResponse activity(String status, String cancelledFromStatus) {
        if (!"CANCELLED".equals(status)) return running(ACTIVITY, indexOf(ACTIVITY, status));
        int last = ACTIVITY.size() - 1;
        int from = cancelledFromStatus == null ? -1 : indexOf(ACTIVITY, cancelledFromStatus);
        boolean known = cancelledFromStatus != null && from < last && ACTIVITY.get(from).code().equals(cancelledFromStatus);
        return new WorkflowProgressResponse(ACTIVITY, last, List.of(), known ? ACTIVITY.get(from).label() : "");
    }

    /** An activity that is being created and has no record yet: it starts at "New" and is Planned once it is saved. */
    public static WorkflowProgressResponse newActivity() {
        List<WorkflowStepResponse> steps = new ArrayList<>();
        steps.add(step("NEW", "New"));
        steps.addAll(ACTIVITY.subList(1, ACTIVITY.size()));
        return running(steps, 0);
    }

    // ---- Training Assessment ----

    private static final List<WorkflowStepResponse> ASSESSMENT = List.of(
            step("DRAFT", "Draft"),
            step("PENDING_APPROVAL", "Pending Approval"),
            step("EFFECTIVE", "Effective"),
            end("OBSOLETED", "Obsoleted"));

    /** An obsoleted assessment was effective before; an assessment that is being created (no status) is a draft. */
    public static WorkflowProgressResponse assessment(String status) {
        return new WorkflowProgressResponse(ASSESSMENT, indexOf(ASSESSMENT, status), List.of(), "OBSOLETED".equals(status) ? "Effective" : "");
    }

    // ---- Job assignment ----

    private static final List<WorkflowStepResponse> JOB = List.of(
            step("DRAFT", "Draft"),
            step("PENDING_RECEIVER", "Pending Employee Acceptance"),
            step("EFFECTIVE", "Effective"));

    /** The last step is the end the assignment took: "Cancelled" for a cancelled one (shown from Draft), otherwise "Obsoleted" (reached from Effective). */
    public static WorkflowProgressResponse job(String status) {
        boolean cancelled = "CANCELLED".equals(status);
        boolean obsoleted = "OBSOLETED".equals(status);
        List<WorkflowStepResponse> steps = new ArrayList<>(JOB);
        steps.add(cancelled ? end("CANCELLED", "Cancelled") : end("OBSOLETED", "Obsoleted"));
        if (cancelled) return new WorkflowProgressResponse(steps, 3, List.of(), "Draft");
        if (obsoleted) return new WorkflowProgressResponse(steps, 3, List.of(), "Effective");
        return running(steps, indexOf(JOB, status));
    }

    // ---- Training Matrix version ----

    private static final List<WorkflowStepResponse> MATRIX_VERSION = List.of(
            step("DRAFT", "Draft"),
            step("PENDING_APPROVAL", "Pending Approval"),
            step("EFFECTIVE", "Effective"),
            end("OBSOLETED", "Obsoleted"));

    public static WorkflowProgressResponse matrixVersion(String status) {
        return new WorkflowProgressResponse(MATRIX_VERSION, indexOf(MATRIX_VERSION, status), List.of(), "OBSOLETED".equals(status) ? "Effective" : "");
    }

    // ---- Personnel training review ----

    private static final List<WorkflowStepResponse> REVIEW = List.of(
            step("OPEN", "Open"),
            step("CLOSED", "Closed"),
            end("CANCELLED", "Cancelled"));

    /** A review ends closed or cancelled; all three steps are always shown and the end that was not taken is striped. */
    public static WorkflowProgressResponse personnelReview(String status) {
        if ("OPEN".equals(status)) return running(REVIEW, 0);
        if ("CLOSED".equals(status)) return new WorkflowProgressResponse(REVIEW, 1, List.of("Cancelled"), "");
        return new WorkflowProgressResponse(REVIEW, 2, List.of(), "Open");
    }

    // ---- Training Requirement ----

    private static final List<WorkflowStepResponse> REQUIREMENT = List.of(
            step("DRAFT", "Draft"),
            step("PENDING_REVIEW", "Pending Review"),
            step("PENDING_APPROVAL", "Pending Approval"),
            step("APPROVED", "Approved"));

    public static WorkflowProgressResponse requirement(String status) {
        return running(REQUIREMENT, indexOf(REQUIREMENT, status));
    }

    // ---- Specimen signature ----

    private static final List<WorkflowStepResponse> SPECIMEN = List.of(
            step("CURRENT", "Current"),
            step("SUPERSEDED", "Superseded"));

    /** The newest scan is Current (also while it waits for its confirmation); an earlier one is Superseded. */
    public static WorkflowProgressResponse specimen(String status) {
        return running(SPECIMEN, "OBSOLETED".equals(status) ? 1 : 0);
    }
}
