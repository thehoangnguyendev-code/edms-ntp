package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record BusinessUnitDictionaryRequest(
        @NotBlank String name,
        @NotBlank String abbreviation,
        String description,
        Boolean isActive
) {
}
