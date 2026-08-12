package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyExpiryLimitResponse(
        String id,
        String documentTypeId,
        String documentTypeName,
        String departmentId,
        String departmentName,
        int maxDurationDays,
        boolean active,
        boolean isSystem,
        String description
) {}
