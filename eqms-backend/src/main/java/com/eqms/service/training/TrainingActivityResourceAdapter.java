package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.authorization.PolicyBackedAdapter;
import com.eqms.service.WorkflowActionPolicyService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A training activity as a resource of the Hybrid engine: Planned, Notified, In Progress, Pending QA Confirmation, Completed, Cancelled. Only the actions on the activity itself are here; the actions
 * on one participant (attendance, reading, check-in) are another resource. The relations of the actor, as {@code TrainingActivityService} computes them:
 * <ul>
 *   <li>{@code SENDER} - the trainer of a session that is not cancelled, or, when a session has no trainer, a person who holds the conduct or organize permission in the department
 *       ({@code isSender}); a trainer needs no permission and no department;</li>
 *   <li>{@code CONTENT_CREATOR} (the person who created the activity), {@code CONTENT_REVIEWER} (signed the review of the content) and {@code LIST_PREPARER} (confirmed the list), who are kept
 *       apart from the steps they would otherwise take ({@code keptApart});</li>
 *   <li>{@code CONTENT_REVIEW_ASSIGNEE} and {@code CONTENT_APPROVE_ASSIGNEE} - the person designated for the step.</li>
 * </ul>
 */
@Component
public class TrainingActivityResourceAdapter extends PolicyBackedAdapter {
    public static final String TYPE = "TRAINING_ACTIVITY";

    private final TrainingAccess access;

    public TrainingActivityResourceAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        super(jdbc, policies, relations, "TRAINING", "TRAINING_ACTIVITY", TYPE);
        this.access = access;
    }

    @Override
    protected String table() {
        return "training_activities";
    }

    /** The department of the record limits the action (a person acts in their own department unless they hold training.scope.all), except for the trainer who sends and finishes, whose relation SENDER already holds the rule. */
    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        Facts facts = facts(actor, resourceId);
        if (facts == null) return false;
        if ("SEND_ATTENDANCE_LIST".equals(action) || "FINISH".equals(action)) return true;
        return access.inScope(actor, facts.departmentId());
    }

    @Override
    protected Facts facts(UserAccount actor, UUID id) {
        Map<String, Object> a = one(jdbc.queryForList("select organizer_department_id, created_by, list_prepared_by from training_activities where id = ?", id));
        if (a == null || actor == null || actor.getId() == null) return null;
        UUID me = actor.getId();
        UUID department = (UUID) a.get("organizer_department_id");
        Set<String> relations = new HashSet<>();
        if (me.equals(a.get("created_by"))) relations.add("CONTENT_CREATOR");
        if (me.equals(a.get("list_prepared_by"))) relations.add("LIST_PREPARER");
        if (jdbc.queryForList("select confirmed_by from training_active_confirmations where activity_id=? and kind='CONTENT_REVIEWED'", UUID.class, id).contains(me)) relations.add("CONTENT_REVIEWER");
        if (pendingAssignees(TYPE, id, "CONTENT_REVIEW").contains(me)) relations.add("CONTENT_REVIEW_ASSIGNEE");
        if (pendingAssignees(TYPE, id, "CONTENT_APPROVE").contains(me)) relations.add("CONTENT_APPROVE_ASSIGNEE");
        if (isSender(actor, id, department)) relations.add("SENDER");
        if (access.has(actor, "training.activity.conduct", "training.activity.organize")) relations.add("CONDUCTOR");
        return new Facts(department, relations);
    }

    /** Designating the person of an approval step has no state of its own in the service: one policy applies in every state. */
    @Override
    protected String policyState(String action, String state) {
        return "DESIGNATE".equals(action) && state != null ? "ANY" : state;
    }

    /** Mirrors {@code TrainingActivityService.isSender}. */
    private boolean isSender(UserAccount actor, UUID id, UUID department) {
        Integer asTrainer = jdbc.queryForObject("select count(*) from training_sessions where activity_id = ? and status <> 'CANCELLED' and trainer_user_id = ?", Integer.class, id, actor.getId());
        if (asTrainer != null && asTrainer > 0) return true;
        Integer withoutTrainer = jdbc.queryForObject("select count(*) from training_sessions where activity_id = ? and status <> 'CANCELLED' and trainer_user_id is null", Integer.class, id);
        return withoutTrainer != null && withoutTrainer > 0 && access.has(actor, "training.activity.conduct", "training.activity.organize") && access.inScope(actor, department);
    }
}
