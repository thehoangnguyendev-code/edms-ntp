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
        // Optional. The number written on the paper training record of this revision (training done before the system existed), typed by the person who
        // imports it, so that the paper record can be found from the system later. Kept as typed; never issued by Training Management.
        String trainingNumber,
        boolean hasFile,
        // Required when hasFile is false -- e.g. "original scan not located in the paper archive".
        String noFileJustification,
        // The users behind the historical reviewer(s) and approver chosen on the form (account ids). The names above stay the reference text; a person who is a user of the system and
        // signed the paper revision gets the initial training record of the revision when its training evidence is verified (D-45).
        java.util.List<String> legacyHistoricalReviewerIds,
        String legacyHistoricalApproverId,
        // The paper training of the revision (Training Management): the users who were trained, and the evidence itself. The scan of APD.0108 or APD.0117
        // comes in the parallel "trainingScans" part, in the order of the sections with hasTrainingScan=true; or the paper is declared lost with a reason.
        java.util.List<String> traineeIds,
        boolean trainingNotEvidenced,
        String trainingNoEvidenceReason,
        boolean hasTrainingScan,
        // What the paper training was (kept on the historical activity): the Training Topic, the Trainer as written on the paper, and the Mode
        // (SELF_READING, CLASSROOM, HYBRID or PRACTICAL). Asked when the Training Number starts a new activity and the paper record is not lost.
        String trainingTopic,
        String trainingTrainer,
        String trainingMethod
) {
    /** The form of a section before the paper training was part of the import: no training evidence is carried. */
    public LegacyBatchRevisionSectionRequest(String revisionNumber, String authorId, String legacyHistoricalAuthoredDate, String legacyHistoricalReviewers, String legacyHistoricalApprover,
                                             String legacyHistoricalReviewDate, String legacyHistoricalApprovalDate, String changeDescription, String effectiveDate,
                                             String trainingCompletionDate, String trainingNumber, boolean hasFile, String noFileJustification) {
        this(revisionNumber, authorId, legacyHistoricalAuthoredDate, legacyHistoricalReviewers, legacyHistoricalApprover, legacyHistoricalReviewDate, legacyHistoricalApprovalDate,
                changeDescription, effectiveDate, trainingCompletionDate, trainingNumber, hasFile, noFileJustification, null, null, null, false, null, false, null, null, null);
    }
}
