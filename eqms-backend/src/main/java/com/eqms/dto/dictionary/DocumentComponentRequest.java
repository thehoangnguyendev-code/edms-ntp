package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;

/**
 * Create/update request for a Document Component. Admins may only ever create/update FREE_TEXT
 * components (see {@link com.eqms.entity.DocumentComponent}'s class javadoc for why) -- the
 * service rejects any attempt to set sourceTable/sourceField themselves, or to edit an existing
 * system-defined (field-bound) component's mapping. isActive and displayOrder are the only
 * writable fields on a system-defined component.
 */
public record DocumentComponentRequest(
        @NotBlank String name,
        String shortDescription,
        /** Literal text this component renders. Required (and the only data field) for a new component. */
        String freeText,
        Boolean isActive,
        Integer displayOrder
) {
}
