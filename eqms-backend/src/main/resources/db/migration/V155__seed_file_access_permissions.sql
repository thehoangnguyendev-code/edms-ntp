-- V155: Seed file-access permission codes used by SecureFileAccessService (Sprint 2)
-- These permissions gate revision source files, published PDFs, and controlled copies.
-- They are NOT assigned broadly; see comments for recommended access profile assignment.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
SELECT id, code, name, category, module_key, group_key, description, display_order, requires_audit
FROM (VALUES
    ('72111111-1111-1111-1111-111111111201'::uuid, 'documents.revision.preview',                  'Preview Revision',                    'Revision Files',        'documents', 'revision_files',        'Preview a revision PDF (review snapshot or published).',                                 500, FALSE),
    ('72111111-1111-1111-1111-111111111202'::uuid, 'documents.revision.upload_source',             'Upload Revision Source',              'Revision Files',        'documents', 'revision_files',        'Upload or replace the source DOCX file for a Draft revision.',                           510, FALSE),
    ('72111111-1111-1111-1111-111111111203'::uuid, 'documents.revision.download_source',           'Download Revision Source',            'Revision Files',        'documents', 'revision_files',        'Download the source DOCX file of a revision.',                                          520, FALSE),
    ('72111111-1111-1111-1111-111111111204'::uuid, 'documents.revision.edit_online',               'Edit Revision Online',                'Revision Files',        'documents', 'revision_files',        'Open a revision source file in Office Online for editing.',                              530, FALSE),
    ('72111111-1111-1111-1111-111111111205'::uuid, 'documents.revision.generate_preview',          'Generate Revision Preview',           'Revision Files',        'documents', 'revision_files',        'Trigger generation of a revision PDF preview snapshot.',                                 540, FALSE),
    ('72111111-1111-1111-1111-111111111206'::uuid, 'documents.document.preview_published',         'Preview Published Document',          'Document Files',        'documents', 'document_files',        'Preview the published PDF of an effective or obsoleted document.',                       550, FALSE),
    ('72111111-1111-1111-1111-111111111207'::uuid, 'documents.document.download_published',        'Download Published Document',         'Document Files',        'documents', 'document_files',        'Download the published source file of an effective or obsoleted document.',              560, FALSE),
    ('72111111-1111-1111-1111-111111111208'::uuid, 'documents.controlled_copy.view_file',          'View Controlled Copy File',           'Controlled Copy Files', 'documents', 'controlled_copy_files', 'View a controlled copy PDF in the portal.',                                              570, FALSE),
    ('72111111-1111-1111-1111-111111111209'::uuid, 'documents.controlled_copy.download_file',      'Download Controlled Copy File',       'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Download a controlled copy PDF file.',                                                   580, FALSE),
    ('72111111-1111-1111-1111-111111111210'::uuid, 'documents.controlled_copy.generate',           'Generate Controlled Copy',            'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Generate and issue a new controlled copy.',                                              590, TRUE),
    ('72111111-1111-1111-1111-111111111211'::uuid, 'documents.controlled_copy.view_evidence',      'View Controlled Copy Evidence',       'Controlled Copy Files', 'documents', 'controlled_copy_files', 'View evidence files attached to a controlled copy.',                                     600, FALSE),
    ('72111111-1111-1111-1111-111111111212'::uuid, 'documents.controlled_copy.download_evidence',  'Download Controlled Copy Evidence',   'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Download evidence files attached to a controlled copy.',                                 610, FALSE),
    ('72111111-1111-1111-1111-111111111213'::uuid, 'documents.controlled_copy.upload_evidence',    'Upload Controlled Copy Evidence',     'Controlled Copy Files', 'documents', 'controlled_copy_files', 'Upload evidence files to a controlled copy record.',                                     620, FALSE)
) AS v(id, code, name, category, module_key, group_key, description, display_order, requires_audit)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = v.code);

-- Assign all file-access permissions to Document Admin / DCO roles if they exist.
-- Conservative: only roles whose code matches known DCO/admin patterns receive these.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN (
    'DOCUMENT_ADMIN', 'DCO', 'DOCUMENT_CONTROL_OFFICER',
    'DOCUMENT_CONTROL_ADMIN', 'QA_ADMIN', 'QA_MANAGER'
)
  AND p.code IN (
      'documents.revision.preview',
      'documents.revision.upload_source',
      'documents.revision.download_source',
      'documents.revision.edit_online',
      'documents.revision.generate_preview',
      'documents.document.preview_published',
      'documents.document.download_published',
      'documents.controlled_copy.view_file',
      'documents.controlled_copy.download_file',
      'documents.controlled_copy.generate',
      'documents.controlled_copy.view_evidence',
      'documents.controlled_copy.download_evidence',
      'documents.controlled_copy.upload_evidence'
  )
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Assign revision preview to reviewer / approver roles so they can view review snapshots.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE UPPER(r.code) IN ('REVIEWER', 'APPROVER', 'DOCUMENT_REVIEWER', 'DOCUMENT_APPROVER')
  AND p.code = 'documents.revision.preview'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- NOTE: documents.document.preview_published and documents.document.download_published are
-- intentionally NOT assigned to general users here to avoid broad access.
-- These should be assigned via Access Profiles in the UI (Sprint 3).
