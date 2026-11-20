package com.eqms.dto.settings;

public record AccessProfileRequest(
        String code,
        String name,
        String description,
        String type,
        boolean active,
        String signatureToken,
        String reason
) {}
