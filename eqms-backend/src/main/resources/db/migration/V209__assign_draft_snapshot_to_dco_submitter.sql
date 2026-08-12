-- DCO owns submission for review. The review snapshot remains a technical
-- prerequisite of that action and must therefore be available to the same actor.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.revision.submit_review',
    description = 'DCO or Document Admin prepares the technical review snapshot before submitting for review.'
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
SELECT policy.id, actor.actor_type
FROM workflow_action_policies policy
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS actor(actor_type)
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.from_status = 'DRAFT'
  AND policy.action_code IN ('GENERATE_REVIEW_SNAPSHOT', 'REGENERATE_SNAPSHOT')
  AND policy.active = TRUE;
