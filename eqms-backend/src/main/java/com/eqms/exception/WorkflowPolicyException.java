package com.eqms.exception;

/**
 * Thrown for workflow action policy administration errors.
 * errorCode maps to the Sprint 5 error code catalogue.
 */
public class WorkflowPolicyException extends RuntimeException {

    private final String errorCode;
    private final int httpStatus;

    public WorkflowPolicyException(String errorCode, String message, int httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public static WorkflowPolicyException notFound(String detail) {
        return new WorkflowPolicyException("WORKFLOW_POLICY_NOT_FOUND", detail, 404);
    }

    public static WorkflowPolicyException duplicate(String detail) {
        return new WorkflowPolicyException("WORKFLOW_POLICY_DUPLICATE", detail, 409);
    }

    public static WorkflowPolicyException validationError(String detail) {
        return new WorkflowPolicyException("WORKFLOW_POLICY_VALIDATION_ERROR", detail, 400);
    }

    public static WorkflowPolicyException deactivationBlocked(String detail) {
        return new WorkflowPolicyException("WORKFLOW_POLICY_DEACTIVATION_BLOCKED", detail, 409);
    }

    public static WorkflowPolicyException resetNotAllowed(String detail) {
        return new WorkflowPolicyException("WORKFLOW_POLICY_RESET_NOT_ALLOWED", detail, 400);
    }

    public String getErrorCode() { return errorCode; }
    public int getHttpStatus() { return httpStatus; }
}
