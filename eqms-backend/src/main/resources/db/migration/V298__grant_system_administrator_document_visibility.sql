-- System administrators need read-only oversight of every Document Control
-- record.  This is granted through the immutable SYSTEM_ADMINISTRATION
-- permission set, never inferred from an Access Profile display name or a
-- user name.  Operational workflow actions remain governed by their own
-- permissions and assignment/state policies.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), permission_set.id, permission.id
FROM permission_sets permission_set
JOIN permissions permission ON permission.code = 'documents.document.view_all'
WHERE permission_set.code = 'SYSTEM_ADMINISTRATION'
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = permission_set.id
        AND existing.permission_id = permission.id
  );
