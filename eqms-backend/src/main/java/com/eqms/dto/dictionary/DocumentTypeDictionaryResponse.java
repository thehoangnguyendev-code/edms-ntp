package com.eqms.dto.dictionary;

import java.util.UUID;

public record DocumentTypeDictionaryResponse(
        UUID id,
        String name,
        String shortCode,
        int currentSequence,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate,
        String lastIssuedDocumentNumber,
        String nextDocumentNumber
) {
    /** Compatibility constructor for callers compiled against the original API shape. */
    public DocumentTypeDictionaryResponse(
            UUID id,
            String name,
            String shortCode,
            int currentSequence,
            String description,
            boolean isActive,
            String createdDate,
            String modifiedDate
    ) {
        this(id, name, shortCode, currentSequence, description, isActive, createdDate, modifiedDate, null, null);
    }
}
