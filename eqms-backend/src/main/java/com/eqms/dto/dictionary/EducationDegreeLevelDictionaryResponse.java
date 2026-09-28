package com.eqms.dto.dictionary;

import java.util.UUID;

public record EducationDegreeLevelDictionaryResponse(
        UUID id,
        String name,
        int displayOrder,
        boolean isActive,
        String createdDate,
        String modifiedDate
) {
}
