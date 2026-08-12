package com.eqms.exception;

import com.eqms.enums.ControlledCopyWorkflowAction;
import org.springframework.security.access.AccessDeniedException;

public class ControlledCopyAuthorizationException extends AccessDeniedException {
    private final String reasonCode;
    private final String requiredPermissionCode;
    private final ControlledCopyWorkflowAction action;

    public ControlledCopyAuthorizationException(
            String reasonCode,
            String message,
            String requiredPermissionCode,
            ControlledCopyWorkflowAction action
    ) {
        super(message);
        this.reasonCode = reasonCode;
        this.requiredPermissionCode = requiredPermissionCode;
        this.action = action;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public String getRequiredPermissionCode() {
        return requiredPermissionCode;
    }

    public ControlledCopyWorkflowAction getAction() {
        return action;
    }
}
