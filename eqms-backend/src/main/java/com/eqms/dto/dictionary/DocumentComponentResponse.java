package com.eqms.dto.dictionary;

import java.util.UUID;

public record DocumentComponentResponse(
        UUID id,
        String name,
        String value,
        String shortDescription,
        String sourceTable,
        String sourceField,
        String freeText,
        boolean systemDefined,
        boolean isActive,
        int displayOrder,
        String createdDate,
        String modifiedDate,
        /** A representative sample value, for the picker UI ("e.g. SOP", "e.g. 0007"). */
        String sampleValue
) {
}
