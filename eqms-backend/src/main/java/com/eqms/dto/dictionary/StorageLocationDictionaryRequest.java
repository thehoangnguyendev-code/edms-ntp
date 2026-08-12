package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record StorageLocationDictionaryRequest(
        @NotBlank String name,
        String description,
        Boolean isActive
) {
}
