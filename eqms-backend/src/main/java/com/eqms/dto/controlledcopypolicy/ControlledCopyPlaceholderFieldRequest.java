package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPlaceholderFieldRequest(
        String fieldKey,
        String label,
        String description,
        Boolean active,
        String signatureToken,
        String reason
) {}
