package com.eqms.dto.dictionary;

import java.util.UUID;

public record PositionDictionaryResponse(
        UUID id,
        String name,
        String businessUnit,
        String department,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate
) {
}
