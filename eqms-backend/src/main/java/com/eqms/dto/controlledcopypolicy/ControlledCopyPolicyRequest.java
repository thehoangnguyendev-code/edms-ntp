package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyRequest(
        ControlledCopyPolicyDistributionSecuritySection distributionSecurity,
        ControlledCopyPolicyRecallSection recallLostDamaged,
        ControlledCopyPolicyDeliverySection delivery,
        ControlledCopyPolicyMarkingSection marking,
        java.util.Map<String, ControlledCopyStatusMarking> statusMarking,
        /** Null leaves the Expiry Duration Policy untouched; otherwise the full desired end-state list
         *  (see {@link ControlledCopyExpiryLimitInput}), saved under this same request's signature. */
        java.util.List<ControlledCopyExpiryLimitInput> expiryLimits,
        String signatureToken,
        String reason
) {}
