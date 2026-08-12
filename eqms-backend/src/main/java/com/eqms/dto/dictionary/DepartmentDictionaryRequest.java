package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record DepartmentDictionaryRequest(
        @NotBlank String name,
        @NotBlank String abbreviation,
        @NotBlank String businessUnit,
        String description,
        Boolean isActive
) {
}
