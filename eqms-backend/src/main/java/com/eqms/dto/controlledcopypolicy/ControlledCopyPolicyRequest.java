package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyRequest(
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyRecallSection recallLostDamaged,
        String signatureToken,
        String reason
) {}
