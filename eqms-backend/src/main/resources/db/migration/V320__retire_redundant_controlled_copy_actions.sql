-- Controlled Copy requests are created directly in READY_FOR_DISTRIBUTION.
-- Distribution is the single approval/release operation. Retire the old
-- reject/prepare workflow permissions and the unused standalone generate
-- permission without changing audit history or existing copy records.

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('REJECT_REQUEST', 'PREPARE_DISTRIBUTION');

DELETE FROM workflow_action_policies
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'CONTROLLED_COPY'
  AND action_code IN ('REJECT_REQUEST', 'PREPARE_DISTRIBUTION');

DELETE FROM permission_set_items item
USING permissions permission
WHERE item.permission_id = permission.id
  AND permission.code IN (
      'documents.controlled_copy.reject_request',
      'documents.controlled_copy.prepare_distribution',
      'documents.controlled_copy.generate'
  );

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'documents.controlled_copy.reject_request',
        'documents.controlled_copy.prepare_distribution',
        'documents.controlled_copy.generate'
    )
);

DELETE FROM permissions
WHERE code IN (
    'documents.controlled_copy.reject_request',
    'documents.controlled_copy.prepare_distribution',
    'documents.controlled_copy.generate'
);
