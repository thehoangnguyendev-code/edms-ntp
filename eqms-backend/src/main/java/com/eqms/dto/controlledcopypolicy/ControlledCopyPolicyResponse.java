package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyResponse(
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyRecallSection recallLostDamaged
) {}
