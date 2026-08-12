-- Controlled Copy requests are immediately Ready for Distribution.  There is no
-- separate approval step, and Lost/Damaged is the only supported terminal incident
-- action.  Retire the dead Approve/Destroy catalog entries without touching audit history.

DELETE FROM workflow_action_policy_actors actor
USING workflow_action_policies policy
WHERE actor.policy_id = policy.id
  AND policy.module_key = 'DOCUMENT_CONTROL'
  AND policy.workflow_key = 'CONTROLLED_COPY'
  AND policy.action_code IN ('APPROVE_REQUEST', 'DESTROY_COPY', 'CONFIRM_DESTROY');

DELETE FROM workflow_action_policies
WHERE module_key = 'DOCUMENT_CONTROL'
  AND workflow_key = 'CONTROLLED_COPY'
  AND action_code IN ('APPROVE_REQUEST', 'DESTROY_COPY', 'CONFIRM_DESTROY');

DELETE FROM permission_set_items item
USING permissions permission
WHERE item.permission_id = permission.id
  AND permission.code IN (
      'documents.controlled_copy.approve_request',
      'documents.controlled_copy.destroy',
      'documents.controlled_copy.confirm_destroy'
  );

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'documents.controlled_copy.approve_request',
        'documents.controlled_copy.destroy',
        'documents.controlled_copy.confirm_destroy'
    )
);

DELETE FROM permissions
WHERE code IN (
    'documents.controlled_copy.approve_request',
    'documents.controlled_copy.destroy',
    'documents.controlled_copy.confirm_destroy'
);
