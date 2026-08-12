-- Workspace-managed revision actions depend on the immutable permission code,
-- never on an Access Profile/role display name or an additional action grant.
UPDATE workflow_action_policies
SET required_permission_code = 'documents.workspace.manage',
    description = CASE action_code
        WHEN 'OPEN_PUBLISHING_WORKSPACE'
            THEN 'A user granted document workspace management may open the publishing workspace.'
        WHEN 'SUBMIT_FOR_REVIEW'
            THEN 'A user granted document workspace management may submit the revision for review.'
        ELSE description
    END,
    updated_at = now()
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'DOCUMENT_REVISION'
  AND object_type = 'REVISION'
  AND action_code IN ('OPEN_PUBLISHING_WORKSPACE', 'SUBMIT_FOR_REVIEW');

-- Reconcile actor selectors for these permission-scoped actions. Relation actors
-- used by Author/Reviewer/Approver actions remain untouched.
DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('OPEN_PUBLISHING_WORKSPACE', 'SUBMIT_FOR_REVIEW');

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'PERMISSION', 'documents.workspace.manage', now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('OPEN_PUBLISHING_WORKSPACE', 'SUBMIT_FOR_REVIEW');
