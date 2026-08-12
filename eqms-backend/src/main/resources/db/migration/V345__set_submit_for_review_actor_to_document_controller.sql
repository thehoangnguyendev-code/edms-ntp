-- V345 (T-P1-3 / F-08, Q1/Q11): Document Control, not Author, decides when a revision is
-- ready to enter Review. Author completes editing (COMPLETE_AUTHORING, unaffected by this
-- migration); DCO checks metadata/reviewer-approver assignment/related documents/Office
-- Online/source file before submitting. Same publishing-side reasoning applies to
-- OPEN_PUBLISHING_WORKSPACE (no separate "Publishing Coordinator" profile exists today --
-- confirmed against the live roles table -- so it uses the same DCO/DOCUMENT_CONTROLLER pair).
--
-- V290__align_workspace_managed_revision_actions.sql set both actions' actor to
-- PERMISSION 'documents.workspace.manage' -- any user holding that permission could submit
-- ANY revision for review, not just Document Control staff. This migration narrows the actor
-- to the Access Profile(s) that actually do that job, WITHOUT touching required_permission_code
-- (permission and actor remain independent layers) and WITHOUT hard-coding a role name in
-- Java -- the actor is data, resolved by RevisionWorkflowAuthorizationService.matchesActor's
-- existing ACCESS_PROFILE case via the profile's immutable code. A business later renaming
-- DCO's display label, or repointing this actor at a different Access Profile (e.g. a future
-- "Document Coordinator"/"QA Coordinator" split) via the Workflow Authorization UI, needs no
-- code change and no new migration.
--
-- Rollback (if needed):
--   DELETE FROM workflow_action_policy_actors actor
--   USING workflow_action_policies policy
--   WHERE actor.policy_id = policy.id
--     AND policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION'
--     AND policy.object_type = 'REVISION'
--     AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE')
--     AND actor.actor_type = 'ACCESS_PROFILE' AND actor.actor_code IN ('DCO', 'DOCUMENT_CONTROLLER');
--   INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
--   SELECT gen_random_uuid(), policy.id, 'PERMISSION', 'documents.workspace.manage', now()
--   FROM workflow_action_policies policy
--   WHERE policy.module_key = 'DOCUMENT_CONTROL' AND policy.workflow_key = 'DOCUMENT_REVISION'
--     AND policy.object_type = 'REVISION'
--     AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE');

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE');

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'ACCESS_PROFILE', profile_code.code, now()
FROM workflow_action_policies policy
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_CONTROLLER')) AS profile_code(code)
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code IN ('SUBMIT_FOR_REVIEW', 'OPEN_PUBLISHING_WORKSPACE');
