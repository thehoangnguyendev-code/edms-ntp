package com.eqms.dto.dictionary;

import java.util.UUID;

public record DocumentSubTypeDictionaryResponse(
        UUID id,
        String name,
        UUID documentTypeId,
        String documentType,
        String description,
        String reviewRequirement,
        boolean isActive,
        String createdDate,
        String modifiedDate
) {
}
