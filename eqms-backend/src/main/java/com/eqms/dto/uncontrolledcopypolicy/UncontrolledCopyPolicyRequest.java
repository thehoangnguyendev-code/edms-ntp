package com.eqms.dto.uncontrolledcopypolicy;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;

public record UncontrolledCopyPolicyRequest(
        Boolean approvalRequired,
        Integer validityHours,
        Boolean allowRedownload,
        /** ControlledCopyStatusMarking-shaped watermark/stamp config; null leaves the stored config untouched. */
        ControlledCopyStatusMarking marking,
        String signatureToken,
        String reason,
        java.util.List<UncontrolledCopyRuleChange> eligibilityRuleChanges
) {}
