package com.eqms.service.training;

import java.util.List;
import java.util.Locale;

/**
 * The notices of Training Management, as the notification registry knows them. {@link TrainingNotifier} sends a notice under the code the module raises
 * ({@code TRAINING_INVITED}); the registry holds it as {@code training.invited}, so the Notifications Administration can switch it off, change its
 * channels, recipients, icon and wording, and an e-mail takes the shared e-mail design. The seed gives every event the same default wording: the title and the
 * text the module composes (the placeholders title and message), which an administrator may replace.
 */
public final class TrainingNotificationEvents {

    /**
     * @param code     the code the module raises, as it is written in the training log
     * @param channels the channels the event is sent on by default
     */
    public record Event(String code, String name, String description, String priority, String channels) {
        public Event(String code, String name, String description, String priority) {
            this(code, name, description, priority, "IN_APP,EMAIL");
        }

        /** The code in the registry. */
        public String registryCode() {
            return TrainingNotificationEvents.registryCode(code);
        }
    }

    private static final List<Event> ALL = List.of(
            new Event("TRAINING_ATTENDANCE_SENT", "Attendance List Received", "The organizer sent the attendance list of a training to QA. The e-mail carries the list (APD.0117) as a PDF.", "MEDIUM"),
            new Event("TRAINING_DUE_SOON", "Training Due Soon", "A training the person has to attend is coming up.", "MEDIUM"),
            new Event("TRAINING_IMPACT_WAITING", "Document Impact Waiting", "Documents wait for the training matrix to be updated.", "MEDIUM"),
            new Event("TRAINING_INVITED", "Invited to Training", "A person is invited to attend a training.", "MEDIUM"),
            new Event("TRAINING_JOB_ACCEPTED", "Job Assignment Accepted", "The person accepted a job assignment; the assignor is told.", "LOW"),
            new Event("TRAINING_JOB_WAITING", "Job Assignment Waiting", "A job assignment waits for the person to accept.", "MEDIUM"),
            new Event("TRAINING_LEGACY_IMPORTED", "Paper Document Imported", "A document was imported from paper and its training evidence must be verified.", "MEDIUM"),
            new Event("TRAINING_MAKEUP_PENDING", "Make-up Training Pending", "Absent people have no make-up training yet.", "MEDIUM"),
            new Event("TRAINING_OVERDUE", "Training Overdue", "A training the person has to attend is overdue.", "HIGH"),
            new Event("TRAINING_MATRIX_REVIEW_DUE", "Matrix Review Due", "The training matrix of a department is due for its yearly review before the annual training requirement.", "MEDIUM"),
            new Event("TRAINING_PERSONNEL_EVENT", "Training Review Needed", "A new employee, a return after a long absence, a transfer or a change of position needs a training review.", "HIGH"),
            new Event("TRAINING_PERIODIC_REQUIREMENT_DUE", "Periodic Training Requirement Due", "Periodic training of reviewed documents is not requested.", "MEDIUM"),
            new Event("TRAINING_PREPARATION_ASSIGNED", "Training Preparation Assigned", "The person is asked to prepare the content of a training.", "MEDIUM"),
            new Event("TRAINING_QA_CONFIRM_WAITING", "Results Waiting for QA", "Training results wait for QA to confirm.", "MEDIUM"),
            new Event("TRAINING_QA_LIST_LATE", "QA List Late", "The attendance list for QA is late.", "HIGH"),
            new Event("TRAINING_QA_LIST_TODAY", "QA List Due Today", "The attendance list must be sent to QA today.", "MEDIUM"),
            new Event("TRAINING_READ_DUE_SOON", "Reading Due Soon", "The person has to read and sign a document, and the time is running out.", "MEDIUM"),
            new Event("TRAINING_READ_REMINDER", "Reading Reminder", "The person is asked to read and sign a document.", "MEDIUM"),
            new Event("TRAINING_REQUIREMENT_DUE", "Training Requirement Not Approved", "The training requirement of a year is not approved yet.", "MEDIUM"),
            new Event("TRAINING_REQUIREMENT_LINE_MOVED", "Requirement Line Moved", "A line of a training requirement moved to another month.", "LOW"),
            new Event("TRAINING_REVIEW_CLOSE_DUE", "Review Waiting to Be Closed", "A personnel review waits for the person to close it.", "MEDIUM"),
            new Event("TRAINING_REVIEW_OPEN_DUE", "Review Still Open", "A personnel review still has items to do.", "MEDIUM"),
            new Event("TRAINING_REVIEW_READY", "Review Ready to Close", "A personnel review is ready to be closed.", "MEDIUM"),
            new Event("TRAINING_STEP_ASSIGNED", "Training Step Assigned", "A step of a training process is assigned to the person.", "HIGH"),
            new Event("TRAINING_STEP_REASSIGNED", "Training Step Handed Over", "A step was taken from the person and given to someone else.", "MEDIUM"),
            new Event("TRAINING_STEP_WAITING", "Training Step Waiting", "A step of a training process waits for the person.", "MEDIUM"),
            new Event("TRAINING_SUBMITTED_TO_QA", "Training Submitted to QA", "The results of a training were submitted and wait for QA. The e-mail carries the results as a PDF.", "MEDIUM"),
            new Event("TRAINING_WORK_SUSPENDED", "Work Suspended", "The work of the person was suspended after a failed assessment.", "HIGH"),
            new Event("TRAINING_RESULTS_DUE_TODAY", "Results Due Today", "The results of a training are due today.", "MEDIUM"),
            new Event("TRAINING_RESULTS_LATE", "Results Late", "The results of a training are late.", "HIGH"),
            new Event("TRAINING_CANCELLED", "Training Cancelled", "A training was cancelled.", "HIGH"),
            new Event("TRAINING_COMPLETED", "Training Completed", "A training was confirmed as completed.", "LOW"),
            new Event("TRAINING_REVISION_READY", "Revision Training Ready to Complete", "QA confirmed the training of a document revision: the people of Document Control who may complete the training of the revision are told, in the application and by e-mail, with a link to the revision.", "MEDIUM"),
            new Event("TRAINING_CONTENT_APPROVED", "Training Content Approved", "The content of a training was approved.", "MEDIUM"),
            new Event("TRAINING_CONTENT_REJECTED", "Training Content Rejected", "An approver rejected the content of a training; it returns to Planned.", "HIGH"),
            new Event("TRAINING_SESSION_CANCELLED", "Training Session Cancelled", "A session that people or its trainer had already been told about was cancelled before the training. E-mail only, to the people on the list of the session who had been told and to the trainer who had been told (not to the person who cancelled it).", "MEDIUM"),
            new Event("TRAINING_SESSION_CHANGED", "Training Session Updated", "A short in-app result for the person who runs the training: a session was postponed, cancelled or given another trainer. The people concerned are told by e-mail by the events of the change.", "LOW"),
            new Event("TRAINING_TRAINER_ASSIGNED", "Training Trainer Assigned", "E-mail to the trainer of a session when the training is notified (and again, when the trainer was changed after an earlier notice): the session, the day, the place and who it is taken over from.", "MEDIUM"),
            new Event("TRAINING_TRAINER_REMOVED", "Training Trainer Removed", "E-mail to the trainer who had been told of a session and is replaced when the training is notified again: the session and who takes it over.", "MEDIUM"),
            new Event("TRAINING_POSTPONED", "Training Session Postponed", "A session of a training that people and its trainer had already been told about was postponed to another day. E-mail only, to the people on the list of the session who had been told and to the trainer who had been told (not to the person who postponed it).", "HIGH"),
            new Event("TRAINING_RECORDED", "Training Recorded", "The training was recorded in the training record of the person.", "LOW"),
            new Event("TRAINING_REQUIREMENT_APPROVED", "Training Requirement Approved", "A training requirement was approved.", "MEDIUM"),
            new Event("TRAINING_REQUIREMENT_REJECTED", "Training Requirement Sent Back", "A training requirement was sent back.", "HIGH"),
            new Event("TRAINING_MATRIX_APPROVED", "Training Matrix Approved", "A training matrix was approved and is effective.", "MEDIUM"),
            new Event("TRAINING_MATRIX_REJECTED", "Training Matrix Sent Back", "A training matrix was sent back.", "HIGH"));

    private TrainingNotificationEvents() {
    }

    public static List<Event> all() {
        return ALL;
    }

    /** TRAINING_STEP_ASSIGNED is training.step_assigned in the registry. */
    public static String registryCode(String code) {
        String rest = code == null ? "" : code.trim();
        if (rest.toUpperCase(Locale.ROOT).startsWith("TRAINING_")) rest = rest.substring("TRAINING_".length());
        return "training." + rest.toLowerCase(Locale.ROOT);
    }
}
