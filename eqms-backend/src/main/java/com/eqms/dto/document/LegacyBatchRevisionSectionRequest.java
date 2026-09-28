package com.eqms.dto.document;

/**
 * One historical revision "section" inside a Legacy Batch Import request (see
 * RevisionService#createLegacyImportRevisionsBatch). The whole list is submitted as a single JSON
 * array ("revisions" multipart part); files for sections with hasFile=true are submitted as a
 * parallel "files" multipart part list, in the same relative order as the hasFile=true sections.
 */
public record LegacyBatchRevisionSectionRequest(
        String revisionNumber,
        // Optional per-section Author override -- a UserAccount id. Falls back to the Document's
        // own Author when blank (matches the single-revision Legacy Import default).
        String authorId,
        // "dd/MM/yyyy" -- when the paper original was historically authored/drafted, reference only.
        String legacyHistoricalAuthoredDate,
        String legacyHistoricalReviewers,
        String legacyHistoricalApprover,
        // "dd/MM/yyyy" only, no time -- historical paper-record dates, not a real signature timestamp.
        String legacyHistoricalReviewDate,
        String legacyHistoricalApprovalDate,
        String changeDescription,
        // "dd/MM/yyyy" -- the historical Effective Date this revision actually carried on paper.
        // Required for every section; must be strictly increasing across the batch.
        String effectiveDate,
        // "dd/MM/yyyy" -- when this revision's training was completed (e.g. offline, before this
        // document was brought into the system). Optional. Maps directly onto
        // DocumentRevisionRecord#trainingCompletionDate -- the SAME field the ordinary Pending
        // Training workflow step sets for every other document, not a legacy-only shadow field, so
        // it is already compatible with whatever the Training module currently reads from a
        // revision (and with any future Training module changes built on that same field).
        String trainingCompletionDate,
        boolean hasFile,
        // Required when hasFile is false -- e.g. "original scan not located in the paper archive".
        String noFileJustification
) {
}
