package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record PositionDictionaryRequest(
        @NotBlank String name,
        @NotBlank String abbreviation,
        @NotBlank String businessUnit,
        @NotBlank String department,
        String description,
        Boolean isActive
) {
}
