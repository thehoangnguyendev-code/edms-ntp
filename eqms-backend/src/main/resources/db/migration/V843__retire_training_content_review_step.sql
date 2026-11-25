-- V843: the content of a training activity is approved by one person; the separate review step is retired
-- (owner decision 2026-11-23, DEC-TRAINING-2026-11-23-08). The organizer now chooses one approver ("Select Approver") and that person signs the approval.
--
-- 1. The Workflow Authorization policies of the action CONTENT_REVIEW (from PLANNED and NOTIFIED, V811/V816) can no longer be reached: they are removed rather than left to mislead the
--    Workflow Authorization screen. The policies of CONTENT_APPROVE are not touched.
-- 2. A review that was designated but not signed is cancelled with the reason below (the approval that was designated stays pending and can now be signed without the review).
--    A review that was already signed stays on record as it was signed; nothing is deleted from the confirmations, the signatures or the Audit Trail.
--
-- Rollback (if needed): re-insert the two policies exactly as V811 inserted them (TRAINING_ACTIVITY / TRAINING_ACTIVITY / CONTENT_REVIEW, from status PLANNED and NOTIFIED,
-- permission training.content.review, priority 100, active, system) with the actor of the permission. The cancelled assignments are not restored: the organizer designates again.

DELETE FROM workflow_action_policy_relations relation
USING workflow_action_policies policy
WHERE relation.policy_id = policy.id
  AND policy.module_key = 'TRAINING'
  AND policy.workflow_key = 'TRAINING_ACTIVITY'
  AND policy.object_type = 'TRAINING_ACTIVITY'
  AND policy.action_code = 'CONTENT_REVIEW'
  AND policy.from_status IN ('PLANNED', 'NOTIFIED');

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'TRAINING'
  AND policy.workflow_key = 'TRAINING_ACTIVITY'
  AND policy.object_type = 'TRAINING_ACTIVITY'
  AND policy.action_code = 'CONTENT_REVIEW'
  AND policy.from_status IN ('PLANNED', 'NOTIFIED');

DELETE FROM workflow_action_policies
WHERE module_key = 'TRAINING'
  AND workflow_key = 'TRAINING_ACTIVITY'
  AND object_type = 'TRAINING_ACTIVITY'
  AND action_code = 'CONTENT_REVIEW'
  AND from_status IN ('PLANNED', 'NOTIFIED');

UPDATE training_approval_assignments
   SET status = 'CANCELLED',
       completed_at = now(),
       reason = 'The review step of the content was retired on 2026-11-23: the approver signs the content'
 WHERE object_type = 'TRAINING_ACTIVITY'
   AND step_code = 'CONTENT_REVIEW'
   AND status = 'PENDING';
