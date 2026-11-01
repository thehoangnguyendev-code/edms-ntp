package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;

import java.time.LocalDate;

/**
 * The narrow door between Document Control and Training Management (SDS-TR-001 section 6). Document Control defines it and calls it when a document or
 * revision that requires training is saved, changes status, or is about to complete its training; Training implements it. Document Control never
 * imports a Training class, and works as before when no implementation is present.
 */
public interface TrainingRevisionHooks {

    /** A document draft was created or saved. Only a document that has no revision yet is handled here (its first revision is created later). */
    void onDocumentSaved(DocumentRecord document, UserAccount actor);

    /** A revision was created from a document (new revision, upload, upgrade). */
    void onRevisionCreated(DocumentRevisionRecord revision, UserAccount actor);

    /** The training settings of an open revision were re-synchronised from its document. */
    void onRevisionSynced(DocumentRevisionRecord revision, UserAccount actor);

    /** The status of a revision changed (to Pending Training, back to Draft, cancelled...). */
    void onRevisionStatusChanged(DocumentRevisionRecord revision, String fromStatus, String toStatus, UserAccount actor);

    /**
     * What Document Control needs before it lets "Complete Training" through. {@code null} when the revision does not use the integrated mode (the
     * dates are then typed as before).
     */
    CompletionGate completionGate(DocumentRevisionRecord revision);

    /** True when the number is already used by a training activity or by a revision (any case). */
    default boolean trainingNumberExists(String trainingNumber) {
        return false;
    }

    /** The status of the training activity of the revision (for a list), or null when it has none. */
    default String activityStatus(DocumentRevisionRecord revision) {
        return null;
    }

    record CompletionGate(boolean completed, LocalDate plannedOn, LocalDate periodEndOn, LocalDate completedOn, String trainingNumber) {}

    /**
     * What the person who imports a document from paper entered about the paper training of ONE revision (Legacy Import). The Training Number is the one written on the paper
     * record (never issued by the system); {@code traineeIds} are the persons who were trained, {@code signatoryIds} the author, reviewers and approver of the revision that are users
     * of the system; {@code scan} is the scan of APD.0108 or APD.0117, or {@code notEvidenced} with a reason declares that the paper is lost (nobody else verifies it: the person who
     * imports signs the import). {@code topic}, {@code trainer}
     * (as written on the paper) and {@code method} (SELF_READING, CLASSROOM, HYBRID or PRACTICAL) say what the paper training was; they are kept on the historical activity.
     */
    record LegacyTraining(String paperTrainingNumber, LocalDate completionDate, java.util.List<java.util.UUID> traineeIds, java.util.List<java.util.UUID> signatoryIds,
                          boolean notEvidenced, String reason, String topic, String trainer, String method,
                          org.springframework.web.multipart.MultipartFile scan) {}

    /** A problem with the paper training entered for a revision of an import, in words for the person, or {@code null} when it is acceptable. Called before anything is written. */
    default String legacyTrainingProblem(UserAccount actor, DocumentRecord document, String revisionNumber, LegacyTraining entry) {
        return null;
    }

    /**
     * The revisions of a document imported from paper were created, in the same transaction. {@code entries.get(i)} belongs to {@code revisions.get(i)} and may be {@code null}.
     * A failure here rolls the whole import back.
     */
    default void onLegacyImported(UserAccount actor, DocumentRecord document, java.util.List<DocumentRevisionRecord> revisions, java.util.List<LegacyTraining> entries) {
    }
}
