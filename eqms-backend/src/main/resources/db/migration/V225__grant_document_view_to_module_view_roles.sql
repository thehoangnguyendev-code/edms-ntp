-- documents.document.view is a newer canonical code that no legacy role ever held —
-- the legacy roles carried documents.module.view only. Endpoints that filter by the
-- record-level code (e.g. /security/eligible-users for workflow participant pickers)
-- therefore excluded every legacy-role user. Grant the record-view permission to the
-- ROLE_<code> compatibility sets (and mirror into legacy role_permissions for parity)
-- of every role that already has module access.

-- 1. Compatibility permission sets (the live grant path since the V220 cutover)
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT psi.permission_set_id, pv.id
FROM permission_set_items psi
JOIN permissions pm ON pm.id = psi.permission_id AND pm.code = 'documents.module.view'
JOIN permission_sets ps ON ps.id = psi.permission_set_id AND ps.code LIKE 'ROLE\_%' ESCAPE '\'
CROSS JOIN permissions pv
WHERE pv.code = 'documents.document.view'
  AND NOT EXISTS (
      SELECT 1 FROM permission_set_items existing
      WHERE existing.permission_set_id = psi.permission_set_id
        AND existing.permission_id = pv.id
  );

-- 2. Legacy role_permissions mirror (kept in sync for reporting/parity checks)
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, pv.id
FROM role_permissions rp
JOIN permissions pm ON pm.id = rp.permission_id AND pm.code = 'documents.module.view'
CROSS JOIN permissions pv
WHERE pv.code = 'documents.document.view'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions existing
      WHERE existing.role_id = rp.role_id AND existing.permission_id = pv.id
  );
