package com.eqms.service.authorization;

import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.WorkflowActionPolicyService;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The common part of the adapters of the Training lifecycles that have joined the Hybrid engine (phase C of AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15; rows approved by the owner
 * on 2026-11-18 as they are in code, AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18). A Training step is decided by: the permission of the step, the department of the record (a person
 * acts in their own department unless they hold training.scope.all), the person designated for the step, and the people kept apart from it. The permission and the relations are the policy
 * (rows of workflow_action_policies, edited in Workflow Authorization); the facts of one record come from the subclass.
 * <p>Shadow only for now: the engine's answer is compared with the checks of the service, which still decide.
 */
public abstract class PolicyBackedAdapter implements ResourceAuthorizationAdapter {
    protected final JdbcTemplate jdbc;
    private final WorkflowActionPolicyService policies;
    private final WorkflowActionPolicyRelationRepository relations;
    private final String moduleKey;
    private final String workflowKey;
    private final String resourceType;

    /** What the engine needs to know about one record. */
    public record Facts(UUID departmentId, Set<String> relations) {}

    protected PolicyBackedAdapter(JdbcTemplate jdbc, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations,
                                  String moduleKey, String workflowKey, String resourceType) {
        this.jdbc = jdbc;
        this.moduleKey = moduleKey;
        this.policies = policies;
        this.relations = relations;
        this.workflowKey = workflowKey;
        this.resourceType = resourceType;
    }

    /** The department of the record and the relations the actor has to it; null when the record is not found. */
    protected abstract Facts facts(UserAccount actor, UUID resourceId);

    @Override
    public String resourceType() {
        return resourceType;
    }

    @Override
    public String resolveState(UUID resourceId) {
        return jdbc.queryForList(stateSql(), String.class, resourceId).stream().findFirst().orElse(null);
    }

    /** The status the policy of an action is looked up by. The default is the state of the record; an action that applies from any state returns "ANY" (the state is then a precondition of the service). */
    protected String policyState(String actionCode, String state) {
        return state;
    }

    /** The query of the state of a record (one parameter: its id). The default reads the status column of the table; a record whose state is derived overrides it. */
    protected String stateSql() {
        return "select status from " + table() + " where id = ?";
    }

    /** The table of the record (the state is its status column). */
    protected abstract String table();

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        return null;
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        String fromStatus = policyState(actionCode, state);
        if (fromStatus == null) return Optional.empty();
        return policies.resolvePolicy(moduleKey, workflowKey, resourceType, actionCode, fromStatus, null)
                .map(policy -> new ResolvedPolicy(policy.getRequiredPermissionCode(), policy.getVersion(), codes(policy, false), policy.getRelationMatchRule(), codes(policy, true)));
    }

    private List<String> codes(WorkflowActionPolicy policy, boolean forbidden) {
        return relations.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(policy.getId()).stream()
                .filter(r -> r.isForbidden() == forbidden)
                .map(r -> r.getRelationDefinition().getCode())
                .toList();
    }

    @Override
    public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) {
        Facts facts = facts(actor, resourceId);
        return facts == null ? new HashSet<>() : facts.relations();
    }

    /** Whether the actor is inside the scope that limits this action on the record (a department, an owner...). The module decides what scope means; the default is no limit. */
    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        return facts(actor, resourceId) != null;
    }

    /** The people with an open assignment of the step on the record (Training approval steps). */
    protected Set<UUID> pendingAssignees(String objectType, UUID id, String stepCode) {
        return new HashSet<>(jdbc.queryForList(
                "select assignee_user_id from training_approval_assignments where object_type=? and object_id=? and step_code=? and status='PENDING'", UUID.class, objectType, id, stepCode));
    }

    protected static Map<String, Object> one(List<Map<String, Object>> rows) {
        return rows.isEmpty() ? null : rows.getFirst();
    }
}
