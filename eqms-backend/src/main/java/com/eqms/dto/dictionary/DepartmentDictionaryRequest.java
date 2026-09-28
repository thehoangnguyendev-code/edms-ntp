package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record DepartmentDictionaryRequest(
        @NotBlank String name,
        @NotBlank String abbreviation,
        @NotBlank String businessUnit,
        String description,
        Boolean isActive,
        UUID departmentHeadId,
        String primaryContactPhone
) {
}
