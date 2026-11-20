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
 * A training requirement (SOP) as a resource of the Hybrid engine: Draft, Pending Review, Pending Approval, Approved. The relations of the actor are the ones the service keeps apart or
 * asks for: {@code PREPARER}, {@code REVIEWED_BY} (done), {@code REVIEW_ASSIGNEE} (designated, not yet done) and {@code APPROVAL_ASSIGNEE}, as {@code TrainingRequirementService.kept} computes them.
 */
@Component
public class TrainingRequirementResourceAdapter extends PolicyBackedAdapter {
    public static final String TYPE = "TRAINING_REQUIREMENT";

    private final TrainingAccess access;

    public TrainingRequirementResourceAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        super(jdbc, policies, relations, "TRAINING", "TRAINING_REQUIREMENT", TYPE);
        this.access = access;
    }

    @Override
    protected String table() {
        return "training_requirements";
    }

    /** The department of the record limits the action (a person acts in their own department unless they hold training.scope.all), and a step that chooses the next person also needs the right to designate (the service checks both before it moves the record). */
    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        Facts facts = facts(actor, resourceId);
        if (facts == null) return false;
        if (!access.inScope(actor, facts.departmentId())) return false;
        boolean designates = "SUBMIT".equals(action) || "REVIEW".equals(action);
        return !designates || access.has(actor, "training.approval.designate", "training.requirement.prepare");
    }

    @Override
    protected Facts facts(UserAccount actor, UUID id) {
        Map<String, Object> r = one(jdbc.queryForList("select department_id, prepared_by, reviewed_by from training_requirements where id = ?", id));
        if (r == null || actor == null || actor.getId() == null) return null;
        UUID me = actor.getId();
        Set<String> relations = new HashSet<>();
        if (me.equals(r.get("prepared_by"))) relations.add("PREPARER");
        if (me.equals(r.get("reviewed_by"))) relations.add("REVIEWED_BY");
        if (pendingAssignees(TYPE, id, "REQUIREMENT_REVIEW").contains(me)) relations.add("REVIEW_ASSIGNEE");
        if (pendingAssignees(TYPE, id, "REQUIREMENT_APPROVE").contains(me)) relations.add("APPROVAL_ASSIGNEE");
        return new Facts((UUID) r.get("department_id"), relations);
    }
}
