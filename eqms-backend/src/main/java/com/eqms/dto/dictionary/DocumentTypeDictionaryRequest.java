package com.eqms.dto.dictionary;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record DocumentTypeDictionaryRequest(
        @NotBlank String name,
        @NotBlank String shortCode,
        @NotNull @Min(0) Integer currentSequence,
        String description,
        Boolean isActive,
        /**
         * The Document Name Format to use for this type's document numbers (Phase 2 of the
         * Document Name Formats feature). Null keeps whatever the type already has (or the seeded
         * "Standard" default for a new type) -- see DocumentComponentResolver#isEligibleAsDocumentNumberFormat
         * for why only a narrow set of Formats are actually accepted here.
         */
        UUID nameFormatId,
        /** The text on the band of the Knowledge Base icon (up to 6 characters); empty means the Short Code. */
        String iconLabel,
        /** The colour of the Knowledge Base icon as #rrggbb; empty means a colour chosen from the palette. */
        String iconColor
) {
    /** Compatibility constructor for callers compiled before the icon existed. */
    public DocumentTypeDictionaryRequest(String name, String shortCode, Integer currentSequence, String description, Boolean isActive, UUID nameFormatId) {
        this(name, shortCode, currentSequence, description, isActive, nameFormatId, null, null);
    }
}
