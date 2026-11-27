package com.eqms.dto.document;

/**
 * What a screen needs before it offers "Compare with Effective". {@code unavailableReason} is a machine code
 * (WRONG_STAGE, NO_SOURCE_FILE, NO_EFFECTIVE_REVISION, EFFECTIVE_HAS_NO_DOCX).
 */
public record RevisionComparisonInfoResponse(
        boolean comparisonAvailable,
        String unavailableReason,
        String baselineRevisionNumber
) {
}
