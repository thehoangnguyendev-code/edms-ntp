package com.eqms.service.training;

/**
 * "Waiting for me": the conditions that the lists of Training Management filter by and that the counts of the menu therefore show, written once so that the two cannot differ.
 * A step is waiting when it is assigned to the person and still open; the second approver of a content is assigned only after the first, so a step that is not yet their turn is not counted.
 * Every {@code ?} of a condition is the id of the signed-in person; {@code idColumn} is a fixed column written by the service, never a value of the request.
 */
public final class TrainingWaiting {
    /** The name of the filter in the query of a list. */
    public static final String PARAM = "waitingForMe";

    /** The closer is chosen when the review is opened, but the review waits for them only once no item is pending. */
    static final String NOT_BEFORE_READY = " and (a.object_type <> 'TRAINING_PERSONNEL_REVIEW' or not exists (select 1 from training_personnel_review_items wi where wi.review_id = a.object_id and wi.status = 'PENDING'))";

    private TrainingWaiting() {}

    static String assigned(String objectType, String idColumn) {
        return "exists (select 1 from training_approval_assignments wa where wa.object_type = '" + objectType + "' and wa.object_id = " + idColumn
                + " and wa.status = 'PENDING' and wa.assignee_user_id = ?)";
    }

    /** Two parameters: a step of the activity, or a trainer exception of one of its trainers. */
    static String activity(String idColumn) {
        return "(" + assigned("TRAINING_ACTIVITY", idColumn) + " or exists (select 1 from training_trainer_exceptions wt join training_approval_assignments wa on wa.object_type = 'TRAINING_TRAINER_EXCEPTION' and wa.object_id = wt.id"
                + " where wt.activity_id = " + idColumn + " and wa.status = 'PENDING' and wa.assignee_user_id = ?))";
    }

    /** Two parameters: a signing step, or the acceptance of one's own job assignment. */
    static String jobAssignment() {
        return "(" + assigned("TRAINING_JOB_ASSIGNMENT", "j.id") + " or (j.person_user_id = ? and j.status = 'PENDING_RECEIVER'))";
    }

    /** One parameter. */
    static String personnelReview() {
        return "(r.status = 'OPEN' and not exists (select 1 from training_personnel_review_items wi where wi.review_id = r.id and wi.status = 'PENDING') and "
                + assigned("TRAINING_PERSONNEL_REVIEW", "r.id") + ")";
    }
}
