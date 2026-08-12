package com.eqms.dto.dictionary;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DocumentTypeDictionaryRequest(
        @NotBlank String name,
        @NotBlank String shortCode,
        @NotNull @Min(0) Integer currentSequence,
        String description,
        Boolean isActive
) {
}
