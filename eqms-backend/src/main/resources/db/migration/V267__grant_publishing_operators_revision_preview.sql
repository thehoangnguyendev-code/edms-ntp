-- A user who can open the publishing workspace must be able to inspect both the current
-- source working copy and the immutable review snapshot. Administrators may still revoke this
-- grant through the access-profile permission model.
INSERT INTO permission_set_items (permission_set_id, permission_id)
SELECT DISTINCT publish_set.permission_set_id, preview_permission.id
FROM permission_set_items publish_set
JOIN permissions publish_permission ON publish_permission.id = publish_set.permission_id
JOIN permissions preview_permission ON preview_permission.code = 'documents.revision.preview'
WHERE publish_permission.code = 'documents.revision.publish'
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = publish_set.permission_set_id
        AND existing.permission_id = preview_permission.id
  );
