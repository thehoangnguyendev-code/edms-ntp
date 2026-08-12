package com.eqms.dto.security;

import java.util.UUID;

public record WorkflowActionPolicyDuplicateRequest(
        UUID documentTypeId,
        Integer priority,
        String description,
        Boolean active,
        String changeReason,
        String signatureToken
) {
    /** Backward-compatible constructor without signature token. */
    public WorkflowActionPolicyDuplicateRequest(UUID documentTypeId, Integer priority,
            String description, Boolean active, String changeReason) {
        this(documentTypeId, priority, description, active, changeReason, null);
    }
}
