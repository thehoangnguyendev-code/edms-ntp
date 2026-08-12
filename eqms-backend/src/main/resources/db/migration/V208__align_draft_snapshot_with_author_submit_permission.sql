-- A review snapshot is a technical prerequisite of Author submission, not an
-- independently grantable user permission. Align the seeded Draft policies so
-- the assigned Author can create/regenerate it before submitting for review.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.submit_review',
    description = 'Assigned Author prepares the technical review snapshot before submitting for review.'
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'DOCUMENT_REVISION'
  AND object_type = 'REVISION'
  AND from_status = 'DRAFT'
  AND action_code IN ('GENERATE_REVIEW_SNAPSHOT', 'REGENERATE_SNAPSHOT')
  AND active = TRUE;

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.from_status = 'DRAFT'
  AND policy.action_code IN ('GENERATE_REVIEW_SNAPSHOT', 'REGENERATE_SNAPSHOT')
  AND policy.active = TRUE;

INSERT INTO workflow_action_policy_actors (policy_id, actor_type)
SELECT policy.id, 'AUTHOR'
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.from_status = 'DRAFT'
  AND policy.action_code IN ('GENERATE_REVIEW_SNAPSHOT', 'REGENERATE_SNAPSHOT')
  AND policy.active = TRUE;
