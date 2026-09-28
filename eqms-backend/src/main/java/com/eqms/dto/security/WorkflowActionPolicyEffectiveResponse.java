package com.eqms.dto.security;

public record WorkflowActionPolicyEffectiveResponse(
        String source,
        WorkflowActionPolicyResponse policy,
        boolean fallbackUsed,
        java.util.List<WorkflowActionPolicyResolutionTrace> trace,
        String decisionCode,
        String decisionMessage
) {
    /** Backward-compatible constructor for existing callers during the additive contract rollout. */
    public WorkflowActionPolicyEffectiveResponse(
            String source,
            WorkflowActionPolicyResponse policy,
            boolean fallbackUsed
    ) {
        this(source, policy, fallbackUsed, java.util.List.of(), null, null);
    }
}
