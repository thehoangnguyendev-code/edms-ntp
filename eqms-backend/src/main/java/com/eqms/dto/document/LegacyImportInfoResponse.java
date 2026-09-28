package com.eqms.dto.document;

/**
 * Reference-only Legacy Import metadata for one revision -- never a real electronic signature
 * event, just descriptive text/date recorded from the paper original (see
 * DocumentRevisionRecord#legacyHistoricalReviewers/Approver/ReviewDate/ApprovalDate/AuthoredDate
 * and DocumentRecord#legacyJustification). Only present when the revision was created through
 * RevisionService#createLegacyImportRevisionsBatch (Legacy Import).
 */
public record LegacyImportInfoResponse(
        String legacyJustification,
        String historicalAuthoredDate,
        String historicalReviewers,
        String historicalReviewDate,
        String historicalApprover,
        String historicalApprovalDate
) {
}
