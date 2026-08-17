package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyRequest(
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyRecallSection recallLostDamaged,
        ControlledCopyPolicyDeliverySection delivery,
        String signatureToken,
        String reason
) {}
