-- The Report Lost/Damaged controlled-copy action (V323/V324) is correctly wired to the
-- documents.controlled_copy.report_lost_damaged permission at the workflow-actor level, but no
-- role was ever granted that permission — so every DCO user sees the Submit button hidden on
-- DestroyControlledCopyView.tsx regardless of role. Grant it to the DCO roles.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'documents.controlled_copy.report_lost_damaged'
WHERE r.name IN ('DCO', 'UAT DCO - Quality')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
