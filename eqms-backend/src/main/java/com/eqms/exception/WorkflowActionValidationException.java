package com.eqms.exception;

import java.util.UUID;

/**
 * A business precondition or state conflict for a workflow action.
 *
 * <p>This is deliberately separate from authorization failures.  Callers can
 * distinguish "you do not have permission" from "the record is not ready for
 * this action" without parsing a display message.</p>
 */
public class WorkflowActionValidationException extends RuntimeException {

    private final String errorCode;
    private final int httpStatus;
    private final String action;
    private final String objectType;
    private final UUID objectId;
    private final String currentStatus;
    private final String expectedStatus;

    public WorkflowActionValidationException(
            String errorCode,
            int httpStatus,
            String message,
            String action,
            String objectType,
            UUID objectId,
            String currentStatus,
            String expectedStatus
    ) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.action = action;
        this.objectType = objectType;
        this.objectId = objectId;
        this.currentStatus = currentStatus;
        this.expectedStatus = expectedStatus;
    }

    public String getErrorCode() { return errorCode; }
    public int getHttpStatus() { return httpStatus; }
    public String getAction() { return action; }
    public String getObjectType() { return objectType; }
    public UUID getObjectId() { return objectId; }
    public String getCurrentStatus() { return currentStatus; }
    public String getExpectedStatus() { return expectedStatus; }
}
