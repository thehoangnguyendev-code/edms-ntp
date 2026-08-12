-- An assigned Author may initiate the next Draft from their own Effective
-- revision.  The workflow remains permission- and actor-gated; this does not
-- grant access to another document's revision.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), source.permission_set_id, upgrade_permission.id
FROM permission_set_items source
JOIN permissions source_permission ON source_permission.id = source.permission_id
JOIN permissions upgrade_permission ON upgrade_permission.code = 'documents.revision.upgrade'
WHERE source_permission.code = 'documents.revision.upload_source'
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = source.permission_set_id
        AND existing.permission_id = upgrade_permission.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.code = 'documents.revision.upgrade'
WHERE UPPER(role.code) IN ('AUTHOR', 'DOCUMENT_AUTHOR')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions existing
      WHERE existing.role_id = role.id AND existing.permission_id = permission.id
  );

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'AUTHOR', NULL, now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.action_code = 'UPGRADE_REVISION'
  AND policy.from_status = 'EFFECTIVE'
  AND policy.active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM workflow_action_policy_actors actor
      WHERE actor.policy_id = policy.id AND actor.actor_type = 'AUTHOR'
  );

-- Controlled-copy requests are self-service for every user who has normal
-- document viewing access.  The request service still enforces document scope,
-- an Active document, and the current Effective revision.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), viewer.permission_set_id, request_permission.id
FROM (
    SELECT DISTINCT source.permission_set_id
    FROM permission_set_items source
    JOIN permissions viewer_permission ON viewer_permission.id = source.permission_id
    WHERE viewer_permission.code IN ('documents.document.view', 'documents.module.view')
) viewer
JOIN permissions request_permission ON request_permission.code = 'documents.controlled_copy.request'
WHERE NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = viewer.permission_set_id
        AND existing.permission_id = request_permission.id
  );

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), policy.id, 'DOCUMENT_VIEWER', NULL, now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.object_type = 'CONTROLLED_COPY'
  AND policy.action_code = 'REQUEST_COPY'
  AND policy.from_status = 'EFFECTIVE'
  AND policy.active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM workflow_action_policy_actors actor
      WHERE actor.policy_id = policy.id AND actor.actor_type = 'DOCUMENT_VIEWER'
  );
