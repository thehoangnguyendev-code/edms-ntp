-- A user who is authorised to view a document must also be able to view its
-- controlled, published PDF.  Preview remains read-only; download is deliberately
-- not included because it is governed by a separate permission.
--
-- This closes the gap for current Access Profiles (including the UAT DCO profile)
-- that contain documents.document.view but predate the file-access permission set.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, preview_permission.id
FROM permission_sets ps
CROSS JOIN permissions preview_permission
WHERE preview_permission.code = 'documents.document.preview_published'
  AND EXISTS (
      SELECT 1
      FROM permission_set_items existing_item
      JOIN permissions document_view_permission ON document_view_permission.id = existing_item.permission_id
      WHERE existing_item.permission_set_id = ps.id
        AND document_view_permission.code = 'documents.document.view'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing_preview
      WHERE existing_preview.permission_set_id = ps.id
        AND existing_preview.permission_id = preview_permission.id
  );
