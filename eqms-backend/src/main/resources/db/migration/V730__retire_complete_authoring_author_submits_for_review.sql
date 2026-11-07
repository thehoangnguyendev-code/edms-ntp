-- V730: "Complete Editing" (COMPLETE_AUTHORING) is retired. The Author now submits the Draft revision for review
-- directly; Submit for Review locks the source file and records the SUBMITTED_FOR_REVIEW e-signature (the PREPARED
-- signature is no longer collected). Revisions that already carry a PREPARED signature keep it.
--
-- Who may submit stays configuration: SUBMIT_FOR_REVIEW is bound to the revision's Author actor here; Document Control
-- (or any Access Profile/permission) is added back as an actor of that policy in Workflow Authorization, with no deploy.
-- The Authors that could complete editing must still hold the permission that gates submitting, so every permission
-- set that granted documents.revision.complete_authoring now also grants documents.revision.submit_review.
--
-- Rollback (if needed): re-insert the permission 'documents.revision.complete_authoring', its policy
-- (COMPLETE_AUTHORING / DRAFT / actor AUTHOR) and the permission-set links; restore the previous SUBMIT_FOR_REVIEW actors.

-- 1. Whoever could complete editing keeps being able to submit.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), source.permission_set_id, submit.id
FROM (
    SELECT DISTINCT item.permission_set_id
    FROM permission_set_items item
    JOIN permissions permission ON permission.id = item.permission_id
    WHERE permission.code = 'documents.revision.complete_authoring'
) source
JOIN permissions submit ON submit.code = 'documents.revision.submit_review'
WHERE NOT EXISTS (
    SELECT 1
    FROM permission_set_items existing
    WHERE existing.permission_set_id = source.permission_set_id
      AND existing.permission_id = submit.id
);

-- 2. The Author is the actor of Submit for Review.
DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code = 'SUBMIT_FOR_REVIEW';

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'AUTHOR', NULL, now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code = 'SUBMIT_FOR_REVIEW';

-- 3. The retired action, its policy and its permission are removed.
DELETE FROM workflow_action_policies
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'DOCUMENT_REVISION'
  AND object_type = 'REVISION'
  AND action_code = 'COMPLETE_AUTHORING';

DELETE FROM permission_set_items item
USING permissions permission
WHERE item.permission_id = permission.id
  AND permission.code = 'documents.revision.complete_authoring';

DELETE FROM permission_dependencies
WHERE permission_code = 'documents.revision.complete_authoring'
   OR depends_on_code = 'documents.revision.complete_authoring';

DELETE FROM permissions WHERE code = 'documents.revision.complete_authoring';
