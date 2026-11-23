-- V842: a supplementary training (retraining of people who failed, make-up of people who were absent) is arranged only once the activity is COMPLETED
-- (owner decision 2026-11-23, DEC-TRAINING-2026-11-23-02). The service, the capability and the weekly reminder already work only then; the policies
-- that let the action start from IN_PROGRESS or PENDING_QA_CONFIRMATION (V811) can no longer be reached, so they are removed rather than left to mislead
-- the Workflow Authorization screen. The policy for COMPLETED is not touched; nothing else is.
--
-- Rollback (if needed): re-insert the two policies exactly as V811 inserted them (TRAINING_ACTIVITY / TRAINING_ACTIVITY / SUPPLEMENTARY, from status
-- IN_PROGRESS and PENDING_QA_CONFIRMATION, permission training.activity.organize, priority 100, active, system) with the actor of the permission.

DELETE FROM workflow_action_policy_relations relation
USING workflow_action_policies policy
WHERE relation.policy_id = policy.id
  AND policy.module_key = 'TRAINING'
  AND policy.workflow_key = 'TRAINING_ACTIVITY'
  AND policy.object_type = 'TRAINING_ACTIVITY'
  AND policy.action_code = 'SUPPLEMENTARY'
  AND policy.from_status IN ('IN_PROGRESS', 'PENDING_QA_CONFIRMATION');

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'TRAINING'
  AND policy.workflow_key = 'TRAINING_ACTIVITY'
  AND policy.object_type = 'TRAINING_ACTIVITY'
  AND policy.action_code = 'SUPPLEMENTARY'
  AND policy.from_status IN ('IN_PROGRESS', 'PENDING_QA_CONFIRMATION');

DELETE FROM workflow_action_policies
WHERE module_key = 'TRAINING'
  AND workflow_key = 'TRAINING_ACTIVITY'
  AND object_type = 'TRAINING_ACTIVITY'
  AND action_code = 'SUPPLEMENTARY'
  AND from_status IN ('IN_PROGRESS', 'PENDING_QA_CONFIRMATION');
