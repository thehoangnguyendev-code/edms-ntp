-- Training Activity lifecycle, phase 2 (owner decision DEC-TRAINING-2026-11-23-10): once the participants are notified (Notified) nothing of the plan can be edited; the training is
-- started by an explicit action, Start Training, with a signature, after the preparation is done and the tests are printed. Only Postpone stays open in Notified.
-- Forward-only and idempotent. Rollback (if needed): re-insert ADD_SESSION, UPDATE_SESSION, SET_CONTENT_EXEMPTIONS and HOLD_SESSION for NOTIFIED as V816 did, delete START_TRAINING|NOTIFIED.

-- the policies that cannot be reached any more
DELETE FROM workflow_action_policy_relations relation USING workflow_action_policies policy
 WHERE relation.policy_id = policy.id AND policy.module_key = 'TRAINING' AND policy.workflow_key = 'TRAINING_ACTIVITY' AND policy.object_type = 'TRAINING_ACTIVITY'
   AND policy.from_status = 'NOTIFIED' AND policy.action_code IN ('ADD_SESSION', 'UPDATE_SESSION', 'SET_CONTENT_EXEMPTIONS', 'HOLD_SESSION');
DELETE FROM workflow_action_policy_actors actor USING workflow_action_policies policy
 WHERE actor.policy_id = policy.id AND policy.module_key = 'TRAINING' AND policy.workflow_key = 'TRAINING_ACTIVITY' AND policy.object_type = 'TRAINING_ACTIVITY'
   AND policy.from_status = 'NOTIFIED' AND policy.action_code IN ('ADD_SESSION', 'UPDATE_SESSION', 'SET_CONTENT_EXEMPTIONS', 'HOLD_SESSION');
DELETE FROM workflow_action_policies
 WHERE module_key = 'TRAINING' AND workflow_key = 'TRAINING_ACTIVITY' AND object_type = 'TRAINING_ACTIVITY'
   AND from_status = 'NOTIFIED' AND action_code IN ('ADD_SESSION', 'UPDATE_SESSION', 'SET_CONTENT_EXEMPTIONS', 'HOLD_SESSION');

-- Start Training: a conductor in the department of the activity, like holding a session
INSERT INTO workflow_action_policies (
    id, module_key, workflow_key, object_type, action_code, from_status,
    required_permission_code, priority, active, is_system, description, relation_match_rule, created_at, updated_at, version)
SELECT gen_random_uuid(), 'TRAINING', 'TRAINING_ACTIVITY', 'TRAINING_ACTIVITY', 'START_TRAINING', 'NOTIFIED', '', 100, TRUE, TRUE,
       'A conductor, in the department of the activity, starts the training with a signature, once the preparation is done and the tests are printed; the activity goes in progress.', 'ANY', now(), now(), 0
WHERE NOT EXISTS (
    SELECT 1 FROM workflow_action_policies p
     WHERE p.module_key = 'TRAINING' AND p.workflow_key = 'TRAINING_ACTIVITY' AND p.object_type = 'TRAINING_ACTIVITY'
       AND p.action_code = 'START_TRAINING' AND p.from_status = 'NOTIFIED' AND p.document_type_id IS NULL);

INSERT INTO workflow_action_policy_relations (id, policy_id, relation_definition_id, require_sequence, priority, active, forbidden)
SELECT gen_random_uuid(), p.id, d.id, FALSE, 100, TRUE, FALSE
  FROM workflow_action_policies p
  JOIN authorization_relation_definitions d ON d.code = 'CONDUCTOR' AND d.resource_type = 'TRAINING_ACTIVITY'
 WHERE p.module_key = 'TRAINING' AND p.object_type = 'TRAINING_ACTIVITY' AND p.action_code = 'START_TRAINING' AND p.from_status = 'NOTIFIED'
ON CONFLICT (policy_id, relation_definition_id) DO NOTHING;
