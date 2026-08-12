-- Replace Source File and Create Office Online Copy are governed by explicit
-- permission codes, not an Author-only implementation rule. The existing
-- Document Author and Document Contributor permission sets receive the two
-- permissions by default; administrators may subsequently adjust them in
-- Security & Authorization without a code deployment.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps
JOIN permissions p ON p.code IN (
    'documents.revision.upload_source',
    'documents.revision.sync_office'
)
WHERE ps.code IN ('PS_DOCUMENT_AUTHOR', 'PS_UAT_DOCUMENT_CONTRIBUTOR')
  AND NOT EXISTS (
      SELECT 1
      FROM permission_set_items existing
      WHERE existing.permission_set_id = ps.id
        AND existing.permission_id = p.id
  );

UPDATE permissions
SET description = CASE code
    WHEN 'documents.revision.upload_source'
        THEN 'Upload or replace the controlled source file for an authorised Draft revision.'
    WHEN 'documents.revision.sync_office'
        THEN 'Create or synchronize an authorised Draft revision working copy with Office Online.'
    ELSE description
END
WHERE code IN ('documents.revision.upload_source', 'documents.revision.sync_office');
