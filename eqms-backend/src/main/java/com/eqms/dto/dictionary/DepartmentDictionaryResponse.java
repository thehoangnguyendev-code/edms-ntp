package com.eqms.dto.dictionary;

import java.util.UUID;

public record DepartmentDictionaryResponse(
        UUID id,
        String name,
        String abbreviation,
        String businessUnit,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate,
        long positionCount
) {
}
