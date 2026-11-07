package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

public record BusinessUnitDictionaryRequest(
        @NotBlank String name,
        @NotBlank String abbreviation,
        String description,
        Boolean isActive,
        /** The Head of Unit (a user), who may share the whole Unit folder of the Knowledge Base. Optional. */
        java.util.UUID headOfUnitId,
        /** The colour of the Unit's folder in the Knowledge Base as #rrggbb; empty means an automatic colour. */
        String iconColor
) {
    /** Compatibility constructor for callers compiled before the folder colour existed. */
    public BusinessUnitDictionaryRequest(String name, String abbreviation, String description, Boolean isActive, java.util.UUID headOfUnitId) {
        this(name, abbreviation, description, isActive, headOfUnitId, null);
    }
}
