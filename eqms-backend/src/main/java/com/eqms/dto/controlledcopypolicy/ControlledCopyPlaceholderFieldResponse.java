package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPlaceholderFieldResponse(
        String id,
        String fieldKey,
        String label,
        String description,
        boolean active
) {}
