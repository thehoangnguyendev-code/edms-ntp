package com.eqms.dto.dictionary;

import java.util.UUID;

public record RetentionPolicyDictionaryResponse(
        UUID id,
        String name,
        String description,
        Integer retentionDays,
        boolean isActive,
        String createdDate,
        String modifiedDate
) {
}
