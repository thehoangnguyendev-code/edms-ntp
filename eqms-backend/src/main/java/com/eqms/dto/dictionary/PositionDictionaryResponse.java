package com.eqms.dto.dictionary;

import java.util.UUID;

public record PositionDictionaryResponse(
        UUID id,
        String name,
        String abbreviation,
        String businessUnit,
        String department,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate
) {
}
