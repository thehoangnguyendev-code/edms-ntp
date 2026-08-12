package com.eqms.dto.settings;

public record AccessProfileRequest(
        String code,
        String name,
        String description,
        String type,
        boolean active,
        String businessUnitScope,
        String departmentScope,
        String signatureToken,
        String reason
) {}
