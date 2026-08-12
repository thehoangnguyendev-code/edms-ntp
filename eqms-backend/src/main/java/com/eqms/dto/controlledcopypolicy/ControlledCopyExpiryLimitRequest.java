package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyExpiryLimitRequest(
        String documentTypeId,
        String departmentId,
        Integer maxDurationDays,
        Boolean active,
        String description,
        String signatureToken,
        String reason
) {}
