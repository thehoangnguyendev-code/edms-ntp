package com.eqms.dto.document;

import java.time.LocalDate;
import java.util.UUID;

/** A revision that is or was Effective and can be compared with. {@code statusCode} is EFFECTIVE or OBSOLETED. */
public record RevisionComparisonBaselineResponse(
        UUID revisionId,
        String revisionNumber,
        String statusCode,
        LocalDate effectiveDate
) {
}
