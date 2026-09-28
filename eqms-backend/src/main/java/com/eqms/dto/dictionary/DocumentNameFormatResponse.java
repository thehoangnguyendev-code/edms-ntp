package com.eqms.dto.dictionary;

import java.util.List;
import java.util.UUID;

public record DocumentNameFormatResponse(
        UUID id,
        String name,
        String separator,
        String description,
        boolean isActive,
        String createdDate,
        String modifiedDate,
        List<ComponentItem> components,
        /** Composed sample string, e.g. "SOP.0007", for the list/detail preview. */
        String previewExample,
        /**
         * Whether this Format can be assigned as a Document Type's real Document Number Format
         * (Phase 2) -- see DocumentComponentResolver#isEligibleAsDocumentNumberFormat. False for
         * any richer composition (different separator, extra/other components); still usable for
         * preview/cataloging, just not for generating a real, GMP-reconcilable document number yet.
         */
        boolean eligibleForDocumentNumber
) {
    public record ComponentItem(
            UUID componentId,
            String name,
            String value,
            int displayOrder
    ) {
    }
}
