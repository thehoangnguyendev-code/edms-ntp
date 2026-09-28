package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record EducationDegreeLevelDictionaryRequest(
        @NotBlank String name,
        Integer displayOrder,
        Boolean isActive
) {
}
