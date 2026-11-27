package com.eqms.dto.document;

/** Whether the next revision may start from the Word file of the Effective revision. {@code unavailableReason}: NO_EFFECTIVE_REVISION or EFFECTIVE_HAS_NO_DOCX. */
public record EffectiveSourceOptionResponse(
        boolean available,
        String unavailableReason,
        String revisionNumber
) {
}
