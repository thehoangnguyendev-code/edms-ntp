-- Owner decision 2026-11-26: QA no longer returns the results of a training for correction. SOP.0003 has no such step (a failed assessment is retrained, an absent person gets a make-up
-- training, both as new records); QA confirms the completion or the activity is cancelled. The action RETURN_FOR_CORRECTION and the notice training.returned are removed so that the
-- screens of the lifecycle policies and the Notifications Administration list only what can happen. Audit rows and notices already written are not touched.
-- Forward-only and idempotent.
DELETE FROM workflow_action_policy_relations relation USING workflow_action_policies policy
 WHERE relation.policy_id = policy.id AND policy.module_key = 'TRAINING' AND policy.workflow_key = 'TRAINING_ACTIVITY' AND policy.object_type = 'TRAINING_ACTIVITY'
   AND policy.action_code = 'RETURN_FOR_CORRECTION';
DELETE FROM workflow_action_policy_actors actor USING workflow_action_policies policy
 WHERE actor.policy_id = policy.id AND policy.module_key = 'TRAINING' AND policy.workflow_key = 'TRAINING_ACTIVITY' AND policy.object_type = 'TRAINING_ACTIVITY'
   AND policy.action_code = 'RETURN_FOR_CORRECTION';
DELETE FROM workflow_action_policies
 WHERE module_key = 'TRAINING' AND workflow_key = 'TRAINING_ACTIVITY' AND object_type = 'TRAINING_ACTIVITY' AND action_code = 'RETURN_FOR_CORRECTION';

DELETE FROM notification_template_versions WHERE policy_id IN (SELECT id FROM notification_policies WHERE event_code = 'training.returned');
DELETE FROM notification_policies WHERE event_code = 'training.returned';
DELETE FROM notification_event_definitions WHERE code = 'training.returned';
