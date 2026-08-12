-- Complete the fail-closed Document Revision policy catalog.
-- Display names such as DCO or Author are never authorization identifiers:
-- workspace actions use immutable permission codes and source upload uses the
-- revision's AUTHOR relationship.

WITH required_policy(action_code, from_status, permission_code, description) AS (
    VALUES
        ('UPDATE_DRAFT_METADATA', 'DRAFT', 'documents.workspace.manage',
         'A user granted document workspace management may update Draft revision metadata.'),
        ('UPLOAD_SOURCE', 'DRAFT', 'documents.revision.upload_source',
         'Only the assigned revision author may upload or replace the source file.'),
        ('OPEN_PUBLISHING_WORKSPACE', 'READY_FOR_PUBLISHING', 'documents.workspace.manage',
         'A user granted document workspace management may open the publishing workspace.')
), inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        required_permission_code, priority, active, is_system, description,
        created_at, updated_at, version
    )
    SELECT gen_random_uuid(), 'DOCUMENT_CONTROL', 'DOCUMENT_REVISION', 'REVISION',
           required.action_code, required.from_status, required.permission_code,
           100, TRUE, TRUE, required.description, now(), now(), 0
    FROM required_policy required
    WHERE NOT EXISTS (
        SELECT 1
        FROM workflow_action_policies existing
        WHERE existing.module_key = 'DOCUMENT_CONTROL'
          AND existing.workflow_key = 'DOCUMENT_REVISION'
          AND existing.object_type = 'REVISION'
          AND existing.action_code = required.action_code
          AND existing.from_status = required.from_status
          AND existing.active = TRUE
    )
    RETURNING id, action_code
)
INSERT INTO workflow_action_policy_actors (
    id, policy_id, actor_type, actor_code, created_at
)
SELECT gen_random_uuid(), inserted.id,
       CASE WHEN inserted.action_code = 'UPLOAD_SOURCE' THEN 'AUTHOR' ELSE 'PERMISSION' END,
       CASE WHEN inserted.action_code = 'UPLOAD_SOURCE' THEN NULL ELSE 'documents.workspace.manage' END,
       now()
FROM inserted;

-- Reconcile pre-existing active records as well as newly inserted records. This
-- makes the migration safe for databases whose earlier migration history differs.
UPDATE workflow_action_policies policy
SET required_permission_code = CASE policy.action_code
        WHEN 'UPLOAD_SOURCE' THEN 'documents.revision.upload_source'
        ELSE 'documents.workspace.manage'
    END,
    updated_at = now()
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.active = TRUE
  AND (policy.action_code, policy.from_status) IN (
      ('UPDATE_DRAFT_METADATA', 'DRAFT'),
      ('UPLOAD_SOURCE', 'DRAFT'),
      ('OPEN_PUBLISHING_WORKSPACE', 'READY_FOR_PUBLISHING')
  );

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.active = TRUE
  AND (policy.action_code, policy.from_status) IN (
      ('UPDATE_DRAFT_METADATA', 'DRAFT'),
      ('UPLOAD_SOURCE', 'DRAFT'),
      ('OPEN_PUBLISHING_WORKSPACE', 'READY_FOR_PUBLISHING')
  );

INSERT INTO workflow_action_policy_actors (
    id, policy_id, actor_type, actor_code, created_at
)
SELECT gen_random_uuid(), policy.id,
       CASE WHEN policy.action_code = 'UPLOAD_SOURCE' THEN 'AUTHOR' ELSE 'PERMISSION' END,
       CASE WHEN policy.action_code = 'UPLOAD_SOURCE' THEN NULL ELSE 'documents.workspace.manage' END,
       now()
FROM workflow_action_policies policy
WHERE policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'DOCUMENT_REVISION'
  AND policy.object_type = 'REVISION'
  AND policy.active = TRUE
  AND (policy.action_code, policy.from_status) IN (
      ('UPDATE_DRAFT_METADATA', 'DRAFT'),
      ('UPLOAD_SOURCE', 'DRAFT'),
      ('OPEN_PUBLISHING_WORKSPACE', 'READY_FOR_PUBLISHING')
  );
