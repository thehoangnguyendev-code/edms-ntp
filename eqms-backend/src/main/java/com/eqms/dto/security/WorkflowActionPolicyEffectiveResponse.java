package com.eqms.dto.security;

public record WorkflowActionPolicyEffectiveResponse(
        String source,
        WorkflowActionPolicyResponse policy,
        boolean fallbackUsed
) {}
