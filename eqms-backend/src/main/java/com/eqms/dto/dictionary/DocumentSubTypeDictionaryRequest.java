package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record DocumentSubTypeDictionaryRequest(
        @NotBlank String name,
        @NotBlank String documentTypeId,
        String description,
        String reviewRequirement,
        Boolean isActive
) {
    /** Compatibility constructor for existing API clients and regulated tests. */
    public DocumentSubTypeDictionaryRequest(String name, String documentTypeId, String description, Boolean isActive) {
        this(name, documentTypeId, description, null, isActive);
    }
}
