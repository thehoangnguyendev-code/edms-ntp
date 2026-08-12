package com.eqms.dto.dictionary;

import java.util.UUID;

public record StorageLocationDictionaryResponse(
        UUID id,
        String name,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate
) {
}
