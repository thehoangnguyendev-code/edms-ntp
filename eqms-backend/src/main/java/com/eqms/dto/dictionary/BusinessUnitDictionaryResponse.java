package com.eqms.dto.dictionary;

import java.util.UUID;

public record BusinessUnitDictionaryResponse(
        UUID id,
        String name,
        String abbreviation,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate,
        long departmentCount
) {
}
