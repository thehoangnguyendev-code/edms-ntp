package com.eqms.dto.security;

import java.util.UUID;

/** Read-only explanation of a policy-resolution step. Values are stable machine codes. */
public record WorkflowActionPolicyResolutionTrace(
        UUID policyId,
        String scope,
        String outcome,
        String reasonCode,
        String message
) {}
