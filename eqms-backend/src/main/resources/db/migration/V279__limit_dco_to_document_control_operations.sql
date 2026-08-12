-- A DCO may administer document-control operations, but must be assigned a
-- Reviewer/Approver profile when acting in either independent workflow role.
-- System-wide controlled-copy policy is also a System Administration concern.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND UPPER(COALESCE(r.code, '')) = 'DCO'
  AND p.code IN (
      'documents.revision.review',
      'documents.revision.approve',
      'settings.controlled_copy_policy.view',
      'settings.controlled_copy_policy.manage'
  );
