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
        String primaryContactPhone,
        /** The colour of the Department's folder in the Knowledge Base as #rrggbb; empty means an automatic colour. */
        String iconColor
) {
    /** Compatibility constructor for callers compiled before the folder colour existed. */
    public DepartmentDictionaryRequest(String name, String abbreviation, String businessUnit, String description, Boolean isActive,
                                       UUID departmentHeadId, String primaryContactPhone) {
        this(name, abbreviation, businessUnit, description, isActive, departmentHeadId, primaryContactPhone, null);
    }
}
