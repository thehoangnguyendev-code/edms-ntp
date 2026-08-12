package com.eqms.exception;

import com.eqms.enums.RevisionWorkflowAction;

import java.util.UUID;

/**
 * Thrown by RevisionWorkflowAuthorizationService when a workflow action is denied.
 * Maps to HTTP 403 WORKFLOW_ACCESS_DENIED in GlobalExceptionHandler.
 */
public class WorkflowAuthorizationDeniedException extends RuntimeException {

    private final String reasonCode;
    private final String permissionCode;
    private final RevisionWorkflowAction action;
    private final UUID revisionId;
    private final String currentStatus;

    public WorkflowAuthorizationDeniedException(
            String reasonCode,
            String message,
            String permissionCode,
            RevisionWorkflowAction action,
            UUID revisionId,
            String currentStatus
    ) {
        super(message);
        this.reasonCode = reasonCode;
        this.permissionCode = permissionCode;
        this.action = action;
        this.revisionId = revisionId;
        this.currentStatus = currentStatus;
    }

    public WorkflowAuthorizationDeniedException(String reasonCode, String message) {
        this(reasonCode, message, null, null, null, null);
    }

    public String getReasonCode() { return reasonCode; }
    public String getPermissionCode() { return permissionCode; }
    public RevisionWorkflowAction getAction() { return action; }
    public UUID getRevisionId() { return revisionId; }
    public String getCurrentStatus() { return currentStatus; }
}
