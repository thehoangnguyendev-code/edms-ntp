package com.eqms.service;

import com.eqms.dto.security.SeparationRuleResponse;
import com.eqms.dto.security.WorkflowActionPolicyResponse;
import com.eqms.entity.UserAccount;
import com.eqms.exception.WorkflowPolicyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The "a different person" rules (V807, V820, V821) as one list an administrator can switch on or off: "the person who created a campaign cannot complete it", "the approver cannot be the author".
 * A rule is ON while its policy carries an active FORBIDDEN relation; the engine reads the policies, this service only lists and edits them through the one editor that is signed and audited
 * ({@link WorkflowActionPolicyService#setForbiddenRelations}). The catalog table remembers which rules exist, because switching a rule OFF deletes the forbidden relation row.
 * The Document Revision Integrity flags (DocumentWorkflowSetting) are a separate, older mechanism and are not listed here.
 */
@Service
public class SeparationRuleService {
    private static final String VIEW = "security.workflow_authorization.view";
    private static final String MANAGE = "security.workflow_authorization.manage";

    private final JdbcTemplate jdbc;
    private final WorkflowActionPolicyService policies;
    private final PermissionEvaluationService permissions;

    public SeparationRuleService(JdbcTemplate jdbc, WorkflowActionPolicyService policies, PermissionEvaluationService permissions) {
        this.jdbc = jdbc;
        this.policies = policies;
        this.permissions = permissions;
    }

    /** One row of the catalog with the policy it applies to (null when the policy does not exist on this installation). */
    private record Entry(UUID id, String moduleKey, String workflowKey, String objectType, String actionCode, String fromStatus, String relationCode, String description, UUID policyId, UUID relationDefinitionId, String relationLabel) {}

    private List<Entry> entries() {
        return jdbc.query("""
                select c.id, c.module_key, c.workflow_key, c.object_type, c.action_code, c.from_status, c.relation_code, c.description,
                       (select p.id from workflow_action_policies p
                         where p.module_key = c.module_key and p.workflow_key = c.workflow_key and p.object_type = c.object_type
                           and p.action_code = c.action_code and p.from_status = c.from_status and p.document_type_id is null limit 1) as policy_id,
                       d.id as definition_id, d.display_name
                  from separation_rule_catalog c
                  left join authorization_relation_definitions d on d.resource_type = c.object_type and d.code = c.relation_code
                 order by c.module_key, c.workflow_key, c.sort_order, c.action_code, c.relation_code
                """, (rs, i) -> new Entry(
                rs.getObject("id", UUID.class), rs.getString("module_key"), rs.getString("workflow_key"), rs.getString("object_type"), rs.getString("action_code"),
                rs.getString("from_status"), rs.getString("relation_code"), rs.getString("description"),
                rs.getObject("policy_id", UUID.class), rs.getObject("definition_id", UUID.class), rs.getString("display_name")));
    }

    @Transactional(readOnly = true)
    public List<SeparationRuleResponse> list(UserAccount actor) {
        return list(actor, null, null, null);
    }

    /** The rules, filtered here (not in the browser): free text over module, workflow, action, relation and description; one module; ON or OFF ("ON", "OFF", or null for both). */
    @Transactional(readOnly = true)
    public List<SeparationRuleResponse> list(UserAccount actor, String search, String moduleKey, String state) {
        if (!permissions.hasAnyPermission(actor, VIEW, MANAGE)) throw new AccessDeniedException("Workflow authorization view permission required");
        Map<UUID, WorkflowActionPolicyResponse> byId = new HashMap<>();
        for (WorkflowActionPolicyResponse p : policies.listAll()) byId.put(p.id(), p);
        List<SeparationRuleResponse> out = new ArrayList<>();
        for (Entry e : entries()) {
            WorkflowActionPolicyResponse p = e.policyId() == null ? null : byId.get(e.policyId());
            if (p == null || e.relationDefinitionId() == null) continue; // the policy or the relation is not on this installation
            boolean enabled = p.relations() != null && p.relations().stream().anyMatch(r -> r.forbidden() && e.relationCode().equals(r.relationCode()));
            if (moduleKey != null && !moduleKey.isBlank() && !"ALL".equalsIgnoreCase(moduleKey) && !moduleKey.equals(p.moduleKey())) continue;
            if ("ON".equalsIgnoreCase(state) && !enabled) continue;
            if ("OFF".equalsIgnoreCase(state) && enabled) continue;
            if (search != null && !search.isBlank()) {
                String hay = String.join(" ", String.valueOf(p.moduleLabel()), String.valueOf(p.workflowLabel()), String.valueOf(p.actionLabel()), String.valueOf(e.relationLabel()),
                        String.valueOf(e.description())).toLowerCase(java.util.Locale.ROOT);
                if (!hay.contains(search.trim().toLowerCase(java.util.Locale.ROOT))) continue;
            }
            out.add(new SeparationRuleResponse(e.id(), p.moduleKey(), p.moduleLabel(), p.workflowKey(), p.workflowLabel(), p.objectType(), p.actionCode(), p.actionLabel(),
                    p.fromStatus(), p.fromStatusLabel(), e.relationCode(), e.relationLabel(), e.description(), enabled, p.id(), p.active()));
        }
        return out;
    }

    /** One rule and the state it should have. */
    public record Change(UUID id, boolean enabled) {}

    /**
     * Saves several rules at once under ONE signature (the screen lets the administrator tick several before saving; a signature can be used only once). All or nothing; the rules that do not
     * change are left alone. Returns the rules as they are afterwards.
     */
    @Transactional
    public List<SeparationRuleResponse> setMany(List<Change> changes, String reason, String signatureToken, UserAccount actor) {
        if (!permissions.hasPermission(actor, MANAGE)) throw new AccessDeniedException("You do not have permission to manage workflow action policies.");
        if (reason == null || reason.isBlank()) throw WorkflowPolicyException.validationError("A reason is required");
        if (changes == null || changes.isEmpty()) throw WorkflowPolicyException.validationError("There is no change to save");
        Map<UUID, Entry> byId = new HashMap<>();
        for (Entry e : entries()) byId.put(e.id(), e);
        // the new complete set of forbidden relations of each policy touched
        Map<UUID, List<UUID>> forbiddenByPolicy = new java.util.LinkedHashMap<>();
        for (Change change : changes) {
            Entry entry = byId.get(change.id());
            if (entry == null) throw WorkflowPolicyException.notFound("Separation rule not found");
            if (entry.policyId() == null || entry.relationDefinitionId() == null) throw WorkflowPolicyException.notFound("The policy of this rule is not on this installation");
            if (!forbiddenByPolicy.containsKey(entry.policyId())) {
                jdbc.queryForList("select id from workflow_action_policies where id = ? for update", UUID.class, entry.policyId());
                forbiddenByPolicy.put(entry.policyId(), new ArrayList<>(jdbc.queryForList(
                        "select relation_definition_id from workflow_action_policy_relations where policy_id = ? and forbidden and active order by priority", UUID.class, entry.policyId())));
            }
            List<UUID> set = forbiddenByPolicy.get(entry.policyId());
            if (change.enabled() && !set.contains(entry.relationDefinitionId())) set.add(entry.relationDefinitionId());
            if (!change.enabled()) set.remove(entry.relationDefinitionId());
        }
        // a policy whose set did not really change is not touched
        forbiddenByPolicy.entrySet().removeIf(e -> new java.util.HashSet<>(e.getValue()).equals(new java.util.HashSet<>(jdbc.queryForList(
                "select relation_definition_id from workflow_action_policy_relations where policy_id = ? and forbidden and active", UUID.class, e.getKey()))));
        if (!forbiddenByPolicy.isEmpty()) policies.setForbiddenRelationsMany(forbiddenByPolicy, signatureToken, reason.trim(), actor);
        else securityChangeSignatureServiceNoop();
        java.util.Set<UUID> ids = new java.util.HashSet<>();
        changes.forEach(c -> ids.add(c.id()));
        return list(actor, null, null, null).stream().filter(r -> ids.contains(r.id())).toList();
    }

    private void securityChangeSignatureServiceNoop() { /* nothing changed: nothing is signed */ }

    /** Switches one rule ON or OFF. The signature is checked and the change audited by the policy editor; the other rules of the same policy are kept as they are. */
    @Transactional
    public SeparationRuleResponse set(UUID id, boolean enabled, String reason, String signatureToken, UserAccount actor) {
        if (!permissions.hasPermission(actor, MANAGE)) throw new AccessDeniedException("You do not have permission to manage workflow action policies.");
        if (reason == null || reason.isBlank()) throw WorkflowPolicyException.validationError("A reason is required");
        Entry entry = entries().stream().filter(e -> e.id().equals(id)).findFirst().orElseThrow(() -> WorkflowPolicyException.notFound("Separation rule not found"));
        if (entry.policyId() == null || entry.relationDefinitionId() == null) throw WorkflowPolicyException.notFound("The policy of this rule is not on this installation");
        // Lock the policy: two administrators switching two rules of the same policy must not overwrite each other.
        jdbc.queryForList("select id from workflow_action_policies where id = ? for update", UUID.class, entry.policyId());
        List<UUID> forbidden = new ArrayList<>(jdbc.queryForList(
                "select relation_definition_id from workflow_action_policy_relations where policy_id = ? and forbidden and active order by priority", UUID.class, entry.policyId()));
        boolean on = forbidden.contains(entry.relationDefinitionId());
        if (enabled && !on) forbidden.add(entry.relationDefinitionId());
        if (!enabled) forbidden.remove(entry.relationDefinitionId());
        policies.setForbiddenRelations(entry.policyId(), forbidden, signatureToken, reason.trim(), actor);
        return list(actor, null, null, null).stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow(() -> WorkflowPolicyException.notFound("Separation rule not found"));
    }
}
