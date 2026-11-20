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
 * A version of a training matrix as a resource of the Hybrid engine: Draft, Pending Approval, Effective, Obsoleted. The department is the one of the matrix. The relations are
 * {@code PREPARER} (the person who prepared the version, kept apart from its approval) and {@code APPROVAL_ASSIGNEE}, as {@code TrainingMatrixService.keptApart} and the designation do.
 */
@Component
public class TrainingMatrixResourceAdapter extends PolicyBackedAdapter {
    public static final String TYPE = "TRAINING_MATRIX_VERSION";

    private final TrainingAccess access;

    public TrainingMatrixResourceAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        super(jdbc, policies, relations, "TRAINING", "TRAINING_MATRIX", TYPE);
        this.access = access;
    }

    @Override
    protected String table() {
        return "training_matrix_versions";
    }

    /** The department of the record limits the action (a person acts in their own department unless they hold training.scope.all), and a submission also needs the right to designate the approver. */
    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        Facts facts = facts(actor, resourceId);
        if (facts == null) return false;
        if (!access.inScope(actor, facts.departmentId())) return false;
        return !"SUBMIT".equals(action) || access.has(actor, "training.approval.designate", "training.matrix.manage");
    }

    @Override
    protected Facts facts(UserAccount actor, UUID id) {
        Map<String, Object> v = one(jdbc.queryForList(
                "select m.department_id, v.prepared_by from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where v.id = ?", id));
        if (v == null || actor == null || actor.getId() == null) return null;
        UUID me = actor.getId();
        Set<String> relations = new HashSet<>();
        if (me.equals(v.get("prepared_by"))) relations.add("PREPARER");
        if (pendingAssignees(TYPE, id, "MATRIX_APPROVE").contains(me)) relations.add("APPROVAL_ASSIGNEE");
        return new Facts((UUID) v.get("department_id"), relations);
    }
}
