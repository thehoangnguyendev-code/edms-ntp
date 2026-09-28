package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyResponse(
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyRecallSection recallLostDamaged,
        ControlledCopyPolicyDeliverySection delivery,
        ControlledCopyPolicyMarkingSection marking,
        java.util.Map<String, ControlledCopyStatusMarking> statusMarking,
        java.util.List<ControlledCopyExpiryLimitResponse> expiryLimits
) {}
