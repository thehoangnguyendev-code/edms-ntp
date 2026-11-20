package com.eqms.service;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Whether one "a different person" rule is ON (V821): its policy carries an active forbidden relation. The Training services also keep these people out of the list of people who can be chosen for a step;
 * they ask here, so that a rule an administrator switched off is off in the list as well as at the moment of the action. Any failure answers ON: the person stays kept apart (never looser than the rule).
 */
public final class SeparationRuleSwitch {
    private SeparationRuleSwitch() {}

    public static boolean isOn(JdbcTemplate jdbc, String objectType, String actionCode, String relationCode) {
        try {
            Integer n = jdbc.queryForObject("""
                    select count(*) from workflow_action_policy_relations r
                      join workflow_action_policies p on p.id = r.policy_id
                      join authorization_relation_definitions d on d.id = r.relation_definition_id and d.resource_type = p.object_type
                     where r.forbidden and r.active and p.active and p.document_type_id is null
                       and p.object_type = ? and p.action_code = ? and d.code = ?
                    """, Integer.class, objectType, actionCode, relationCode);
            return n != null && n > 0;
        } catch (RuntimeException failure) {
            return true;
        }
    }
}
