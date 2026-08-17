package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyExpiryLimitRequest(
        String documentTypeId,
        String departmentId,
        Integer durationValue,
        String durationUnit,
        Boolean active,
        String signatureToken,
        String reason
) {}
