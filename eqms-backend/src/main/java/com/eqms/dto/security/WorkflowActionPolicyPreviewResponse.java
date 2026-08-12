package com.eqms.dto.security;

import java.util.List;
import java.util.UUID;

public record WorkflowActionPolicyPreviewResponse(
        boolean valid,
        UUID policyId,
        List<PolicyChange> changes,
        List<PolicyWarning> warnings,
        WouldAffect wouldAffect
) {
    public record PolicyChange(String field, String oldValue, String newValue) {}
    public record PolicyWarning(String code, String message) {}
    public record WouldAffect(
            String moduleKey, String workflowKey, String actionCode,
            String fromStatus, UUID documentTypeId) {}
}
