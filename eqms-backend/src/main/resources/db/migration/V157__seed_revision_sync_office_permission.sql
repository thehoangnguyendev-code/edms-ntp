-- V157: Seed documents.revision.sync_office permission (Sprint 3 Patch — Co-Author Boundary)
-- Splits SYNC_TO_OFFICE / SYNC_FROM_OFFICE from documents.revision.edit_online so
-- Co-Authors (who only hold edit_online) cannot trigger file sync between SharePoint and MinIO.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('74111111-1111-1111-1111-111111111701'::uuid,
     'documents.revision.sync_office',
     'Sync Office Online Revision File',
     'Revision Files',
     'documents',
     'revision_files',
     'Sync the revision source file between SharePoint (Office Online) and MinIO. Author and DCO only.',
     535,
     TRUE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- Assign to Author-level roles: DCO, Document Admin, QA Admin/Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN (
    'DOCUMENT_ADMIN', 'DCO', 'DOCUMENT_CONTROL_OFFICER',
    'DOCUMENT_CONTROL_ADMIN', 'QA_ADMIN', 'QA_MANAGER',
    'DOCUMENT_AUTHOR', 'AUTHOR'
)
  AND p.code = 'documents.revision.sync_office'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- NOTE: CO_AUTHOR role intentionally NOT assigned documents.revision.sync_office.
-- Co-Authors only receive documents.revision.edit_online and documents.revision.preview.
