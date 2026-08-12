package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record RetentionPolicyDictionaryRequest(
        @NotBlank String name,
        String description,
        @Positive Integer retentionDays,
        Boolean isActive
) {
}
