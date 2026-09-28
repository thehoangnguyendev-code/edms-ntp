package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyDistributionSecuritySection(
        Boolean allowEmailDistribution,
        Boolean allowPortalView,
        Boolean allowDownload,
        Boolean allowPrint,
        Boolean downloadOnce,
        Boolean printOnce,
        Boolean watermarkEnabled,
        Boolean watermarkCopyNumber,
        Boolean watermarkRecipient,
        Boolean watermarkDistributedDate,
        Boolean watermarkExpiryDate,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer previewSessionMinutes
) {}
