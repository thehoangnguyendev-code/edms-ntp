-- Reconcile the controlled-copy permission catalog, runtime policies, and standard role grants.
-- Controlled Copy has four lifecycle states: READY_FOR_DISTRIBUTION, DISTRIBUTED,
-- OBSOLETED, and CLOSED_CANCELLED. DCO/Document Admin operate lifecycle actions;
-- recipients may only view/download within document scope and configured file policy.

-- Restore catalog entries referenced by the authoritative runtime action registry.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT gen_random_uuid(), item.code, item.name, 'Controlled Copy Files', 'documents', 'controlled_copy_files',
       item.description, item.display_order, item.requires_audit
FROM (VALUES
    ('documents.controlled_copy.reject_request', 'Reject Controlled Copy Request', 'Reject a controlled copy request before distribution.', 712, TRUE),
    ('documents.controlled_copy.prepare_distribution', 'Prepare Controlled Copy Distribution', 'Prepare a controlled copy distribution.', 713, TRUE),
    ('documents.controlled_copy.view', 'View Controlled Copy Log', 'View controlled copy distribution records.', 709, FALSE),
    ('documents.controlled_copy.report_lost_damaged', 'Report Controlled Copy Lost/Damaged', 'Report a distributed controlled copy as lost or damaged.', 716, TRUE),
    ('documents.controlled_copy.upload_evidence', 'Upload Controlled Copy Evidence', 'Upload evidence for a lost or damaged controlled copy.', 717, TRUE),
    ('documents.controlled_copy.expire', 'Expire Controlled Copy', 'Expire a controlled copy according to its validity policy.', 718, TRUE),
    ('documents.controlled_copy.confirm_destroy', 'Confirm Controlled Copy Destruction', 'Confirm controlled copy destruction.', 720, TRUE)
) AS item(code, name, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions existing WHERE existing.code = item.code);

-- All operational Controlled Copy permissions belong to the dedicated DCO set.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), permission_set.id, permission.id
FROM permission_sets permission_set
JOIN permissions permission ON permission.code IN (
    'documents.controlled_copy.request',
    'documents.controlled_copy.approve_request',
    'documents.controlled_copy.reject_request',
    'documents.controlled_copy.prepare_distribution',
    'documents.controlled_copy.view',
    'documents.controlled_copy.view_file',
    'documents.controlled_copy.download_file',
    'documents.controlled_copy.distribute',
    'documents.controlled_copy.recall',
    'documents.controlled_copy.report_lost_damaged',
    'documents.controlled_copy.replace_lost_damaged',
    'documents.controlled_copy.upload_evidence',
    'documents.controlled_copy.expire',
    'documents.controlled_copy.destroy',
    'documents.controlled_copy.confirm_destroy',
    'documents.controlled_copy.cancel_request',
    'documents.controlled_copy.view_evidence',
    'documents.controlled_copy.download_evidence'
)
WHERE permission_set.code IN ('PS_CONTROLLED_COPY_DCO', 'PS_MODULE_DOCUMENTS_MANAGER')
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items existing
      WHERE existing.permission_set_id = permission_set.id
        AND existing.permission_id = permission.id
  );

-- A document approver is not a Controlled Copy approver/distributor. Remove the old test grant.
DELETE FROM permission_set_items item
USING permission_sets permission_set, permissions permission
WHERE item.permission_set_id = permission_set.id
  AND item.permission_id = permission.id
  AND permission_set.code IN ('PS_DOCUMENT_APPROVER', 'PS_UAT_DOCUMENT_APPROVER', 'PS_APPROVER_TEST')
  AND permission.code IN (
      'documents.controlled_copy.view',
      'documents.controlled_copy.view_file',
      'documents.controlled_copy.download_file',
      'documents.controlled_copy.distribute'
  );

-- Add missing system workflow policies using the same action/status contract as the runtime registry.
WITH policy_seed AS (
    SELECT * FROM (VALUES
        ('CONTROLLED_COPY', 'REJECT_REQUEST', 'READY_FOR_DISTRIBUTION', 'documents.controlled_copy.reject_request', 'Reject a controlled copy request'),
        ('CONTROLLED_COPY', 'PREPARE_DISTRIBUTION', 'READY_FOR_DISTRIBUTION', 'documents.controlled_copy.prepare_distribution', 'Prepare controlled copy distribution'),
        ('CONTROLLED_COPY', 'VIEW_COPY', 'READY_FOR_DISTRIBUTION', 'documents.controlled_copy.view', 'View controlled copy before distribution'),
        ('CONTROLLED_COPY', 'VIEW_COPY', 'DISTRIBUTED', 'documents.controlled_copy.view', 'View distributed controlled copy'),
        ('CONTROLLED_COPY', 'REPORT_LOST_DAMAGED', 'DISTRIBUTED', 'documents.controlled_copy.report_lost_damaged', 'Report controlled copy lost or damaged'),
        ('CONTROLLED_COPY', 'UPLOAD_EVIDENCE', 'OBSOLETED', 'documents.controlled_copy.upload_evidence', 'Upload controlled copy evidence'),
        ('CONTROLLED_COPY', 'EXPIRE_COPY', 'READY_FOR_DISTRIBUTION', 'documents.controlled_copy.expire', 'Expire controlled copy before distribution'),
        ('CONTROLLED_COPY', 'EXPIRE_COPY', 'DISTRIBUTED', 'documents.controlled_copy.expire', 'Expire distributed controlled copy'),
        ('CONTROLLED_COPY', 'CONFIRM_DESTROY', 'OBSOLETED', 'documents.controlled_copy.confirm_destroy', 'Confirm controlled copy destruction')
    ) AS seed(object_type, action_code, from_status, required_permission_code, description)
), inserted AS (
    INSERT INTO workflow_action_policies (
        id, module_key, workflow_key, object_type, action_code, from_status,
        document_type_id, required_permission_code, priority, active, is_system, description
    )
    SELECT gen_random_uuid(), 'DOCUMENT_CONTROL', 'CONTROLLED_COPY', seed.object_type, seed.action_code, seed.from_status,
           NULL::uuid, seed.required_permission_code, 100, TRUE, TRUE, seed.description
    FROM policy_seed seed
    WHERE NOT EXISTS (
        SELECT 1 FROM workflow_action_policies existing
        WHERE existing.module_key = 'DOCUMENT_CONTROL'
          AND existing.workflow_key = 'CONTROLLED_COPY'
          AND existing.object_type = seed.object_type
          AND existing.action_code = seed.action_code
          AND existing.from_status = seed.from_status
          AND existing.document_type_id IS NULL
    )
    RETURNING id
)
SELECT 1 FROM inserted;

-- DCO and Document Admin own lifecycle transitions. Recipient visibility is separately scoped.
DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.is_system = TRUE
  AND policy.action_code IN (
      'REQUEST_COPY', 'APPROVE_REQUEST', 'REJECT_REQUEST', 'PREPARE_DISTRIBUTION',
      'DISTRIBUTE_COPY', 'DISTRIBUTE_BATCH', 'RECALL_COPY', 'RECALL_BATCH',
      'REPLACE_LOST_DAMAGED', 'EXPIRE_COPY', 'DESTROY_COPY', 'CONFIRM_DESTROY', 'CANCEL_REQUEST'
  )
  AND actor.actor_type NOT IN ('DCO', 'DOCUMENT_ADMIN');

-- The historical test profile granted the Document Approver distribution rights.
-- Distribution is a DCO-controlled activity and must never be available to an approver.
DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('DISTRIBUTE_COPY', 'DISTRIBUTE_BATCH')
  AND actor.actor_type = 'WORKFLOW_ROLE'
  AND actor.actor_code = 'DOCUMENT_APPROVER';

WITH lifecycle_actors AS (
    SELECT policy.id, actor_type
    FROM workflow_action_policies policy
    CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN')) AS expected(actor_type)
    WHERE policy.module_key = 'DOCUMENT_CONTROL'
      AND policy.workflow_key = 'CONTROLLED_COPY'
      AND policy.is_system = TRUE
      AND policy.action_code IN (
          'REQUEST_COPY', 'APPROVE_REQUEST', 'REJECT_REQUEST', 'PREPARE_DISTRIBUTION',
          'DISTRIBUTE_COPY', 'DISTRIBUTE_BATCH', 'RECALL_COPY', 'RECALL_BATCH',
          'REPLACE_LOST_DAMAGED', 'EXPIRE_COPY', 'DESTROY_COPY', 'CONFIRM_DESTROY', 'CANCEL_REQUEST'
      )
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code)
SELECT gen_random_uuid(), expected.id, expected.actor_type, NULL
FROM lifecycle_actors expected
WHERE NOT EXISTS (
    SELECT 1 FROM workflow_action_policy_actors actor
    WHERE actor.policy_id = expected.id
      AND actor.actor_type = expected.actor_type
      AND actor.actor_code IS NULL
);

-- File access remains restricted by document scope plus the file policy: DCO/Admin or a scoped viewer/recipient.
DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.is_system = TRUE
  AND policy.action_code IN ('VIEW_COPY', 'PREVIEW_FILE', 'DOWNLOAD_FILE')
  AND actor.actor_type NOT IN ('DCO', 'DOCUMENT_ADMIN', 'DOCUMENT_VIEWER', 'OWNER');

WITH file_actors AS (
    SELECT policy.id, actor_type
    FROM workflow_action_policies policy
    CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN'), ('DOCUMENT_VIEWER'), ('OWNER')) AS expected(actor_type)
    WHERE policy.module_key = 'DOCUMENT_CONTROL'
      AND policy.workflow_key = 'CONTROLLED_COPY'
      AND policy.is_system = TRUE
      AND policy.action_code IN ('VIEW_COPY', 'PREVIEW_FILE', 'DOWNLOAD_FILE')
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code)
SELECT gen_random_uuid(), expected.id, expected.actor_type, NULL
FROM file_actors expected
WHERE NOT EXISTS (
    SELECT 1 FROM workflow_action_policy_actors actor
    WHERE actor.policy_id = expected.id
      AND actor.actor_type = expected.actor_type
      AND actor.actor_code IS NULL
);

-- The recipient may report a loss/damage and upload evidence; DCO/Admin retain full control.
WITH recipient_actors AS (
    SELECT policy.id, actor_type
    FROM workflow_action_policies policy
    CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_ADMIN'), ('OWNER')) AS expected(actor_type)
    WHERE policy.module_key = 'DOCUMENT_CONTROL'
      AND policy.workflow_key = 'CONTROLLED_COPY'
      AND policy.is_system = TRUE
      AND policy.action_code IN ('REPORT_LOST_DAMAGED', 'UPLOAD_EVIDENCE')
)
INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code)
SELECT gen_random_uuid(), expected.id, expected.actor_type, NULL
FROM recipient_actors expected
WHERE NOT EXISTS (
    SELECT 1 FROM workflow_action_policy_actors actor
    WHERE actor.policy_id = expected.id
      AND actor.actor_type = expected.actor_type
      AND actor.actor_code IS NULL
);
