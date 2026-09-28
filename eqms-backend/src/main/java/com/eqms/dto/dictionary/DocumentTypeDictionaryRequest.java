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
        UUID nameFormatId
) {
}
