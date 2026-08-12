ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS module_key VARCHAR(80),
    ADD COLUMN IF NOT EXISTS group_key VARCHAR(80),
    ADD COLUMN IF NOT EXISTS description VARCHAR(255),
    ADD COLUMN IF NOT EXISTS display_order INTEGER,
    ADD COLUMN IF NOT EXISTS requires_audit BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE permissions
SET module_key = COALESCE(module_key, CASE
        WHEN category = 'Document Control' THEN 'documents'
        WHEN category = 'User Management' THEN 'settings'
        WHEN category = 'System Settings' THEN 'settings'
        WHEN category = 'Reports' THEN 'reports'
        ELSE lower(replace(category, ' ', '_'))
    END),
    group_key = COALESCE(group_key, CASE
        WHEN category = 'Document Control' THEN 'legacy_document_control'
        WHEN category = 'User Management' THEN 'user_management'
        WHEN category = 'System Settings' THEN 'system_settings'
        WHEN category = 'Reports' THEN 'reports'
        ELSE lower(replace(category, ' ', '_'))
    END),
    description = COALESCE(description, name),
    display_order = COALESCE(display_order, 999),
    requires_audit = COALESCE(requires_audit, FALSE);

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    ('61111111-1111-1111-1111-111111111101', 'CREATE_DOCUMENT_SHELL', 'Create Document Shell', 'Document Metadata', 'documents', 'document_metadata', 'Create a new parent document shell with metadata only.', 10, TRUE),
    ('61111111-1111-1111-1111-111111111102', 'EDIT_DOCUMENT_METADATA', 'Edit Document Metadata', 'Document Metadata', 'documents', 'document_metadata', 'Edit metadata such as document name, type, department, author and review routing.', 20, TRUE),
    ('61111111-1111-1111-1111-111111111103', 'MANAGE_REVIEW_CYCLE', 'Manage Review Cycle', 'Document Metadata', 'documents', 'document_metadata', 'Set or change periodic review cycle and notification settings.', 30, TRUE),
    ('61111111-1111-1111-1111-111111111104', 'MANAGE_DOCUMENT_RELATIONS', 'Manage Document Relationships', 'Document Metadata', 'documents', 'document_metadata', 'Maintain related and correlated document links.', 40, TRUE),
    ('61111111-1111-1111-1111-111111111105', 'UPLOAD_REVISION_FILE', 'Upload Revision File', 'Revision Authoring', 'documents', 'revision_authoring', 'Upload the Word file that starts a new revision workflow.', 50, TRUE),
    ('61111111-1111-1111-1111-111111111106', 'UPLOAD_TO_OFFICE_ONLINE', 'Upload To Office Online', 'Revision Authoring', 'documents', 'revision_authoring', 'Push the draft file to Microsoft Office Online / SharePoint.', 60, TRUE),
    ('61111111-1111-1111-1111-111111111107', 'EDIT_FILE_ONLINE', 'Edit File Online', 'Revision Authoring', 'documents', 'revision_authoring', 'Edit the revision file online before it is submitted for workflow.', 70, TRUE),
    ('61111111-1111-1111-1111-111111111108', 'SUBMIT_REVISION', 'Submit Revision', 'Revision Workflow', 'documents', 'revision_workflow', 'Submit the draft revision into review or approval workflow.', 80, TRUE),
    ('61111111-1111-1111-1111-111111111109', 'CANCEL_REVISION', 'Cancel Revision', 'Revision Workflow', 'documents', 'revision_workflow', 'Cancel a draft revision and close it as cancelled.', 90, TRUE),
    ('61111111-1111-1111-1111-111111111110', 'COMPLETE_REVIEW', 'Complete Review', 'Revision Workflow', 'documents', 'revision_workflow', 'Complete assigned review step and advance revision workflow.', 100, TRUE),
    ('61111111-1111-1111-1111-111111111111', 'REJECT_REVISION', 'Reject Revision', 'Revision Workflow', 'documents', 'revision_workflow', 'Reject a revision during review or approval and send it back to draft.', 110, TRUE),
    ('61111111-1111-1111-1111-111111111112', 'APPROVE_REVISION', 'Approve Revision', 'Revision Workflow', 'documents', 'revision_workflow', 'Approve an assigned revision step.', 120, TRUE),
    ('61111111-1111-1111-1111-111111111113', 'MANAGE_TRAINING_PLAN', 'Manage Training Plan', 'Training & Publishing', 'documents', 'training_and_publishing', 'Populate training dates, training period and distribution details.', 130, TRUE),
    ('61111111-1111-1111-1111-111111111114', 'COMPLETE_TRAINING', 'Complete Training', 'Training & Publishing', 'documents', 'training_and_publishing', 'Mark training as completed and advance the revision.', 140, TRUE),
    ('61111111-1111-1111-1111-111111111115', 'PUBLISH_REVISION', 'Publish Revision', 'Training & Publishing', 'documents', 'training_and_publishing', 'Publish an approved revision and make it effective.', 150, TRUE),
    ('61111111-1111-1111-1111-111111111116', 'VIEW_FINAL_PDF_PREVIEW', 'View Final PDF Preview', 'Training & Publishing', 'documents', 'training_and_publishing', 'Preview the rendered PDF used during review and approval.', 160, FALSE),
    ('61111111-1111-1111-1111-111111111117', 'OBSOLETE_DOCUMENT', 'Obsolete Document', 'Lifecycle & Distribution', 'documents', 'lifecycle_distribution', 'Obsolete an active document and its open revisions.', 170, TRUE),
    ('61111111-1111-1111-1111-111111111118', 'REQUEST_CONTROLLED_COPY', 'Request Controlled Copy', 'Lifecycle & Distribution', 'documents', 'lifecycle_distribution', 'Request or initiate issuance of a controlled copy.', 180, TRUE),
    ('61111111-1111-1111-1111-111111111119', 'AUTHORIZE_CONTROLLED_COPY', 'Authorize Controlled Copy', 'Lifecycle & Distribution', 'documents', 'lifecycle_distribution', 'Authorize controlled copy distribution and apply stamp.', 190, TRUE),
    ('61111111-1111-1111-1111-111111111120', 'PRINT_CONTROLLED_COPY', 'Print Controlled Copy', 'Lifecycle & Distribution', 'documents', 'lifecycle_distribution', 'Print or export a watermarked controlled copy.', 200, TRUE),
    ('61111111-1111-1111-1111-111111111121', 'VIEW_CONTROLLED_COPY_LOG', 'View Controlled Copy Log', 'Lifecycle & Distribution', 'documents', 'lifecycle_distribution', 'View and export controlled copy tracking log.', 210, FALSE),
    ('61111111-1111-1111-1111-111111111122', 'VIEW_DOCUMENT_AUDIT_TRAIL', 'View Document Audit Trail', 'Audit & Compliance', 'documents', 'audit_compliance', 'View audit trail for document and revision records.', 220, FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    module_key = EXCLUDED.module_key,
    group_key = EXCLUDED.group_key,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    requires_audit = EXCLUDED.requires_audit;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DOCUMENTS', 'CREATE_DOCUMENT_SHELL', 'EDIT_DOCUMENT_METADATA', 'MANAGE_REVIEW_CYCLE', 'MANAGE_DOCUMENT_RELATIONS',
    'SUBMIT_REVISION', 'MANAGE_TRAINING_PLAN', 'COMPLETE_TRAINING', 'PUBLISH_REVISION', 'VIEW_FINAL_PDF_PREVIEW',
    'OBSOLETE_DOCUMENT', 'REQUEST_CONTROLLED_COPY', 'AUTHORIZE_CONTROLLED_COPY', 'PRINT_CONTROLLED_COPY',
    'VIEW_CONTROLLED_COPY_LOG', 'VIEW_DOCUMENT_AUDIT_TRAIL'
)
WHERE r.name IN ('Administrator', 'DCO')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DOCUMENTS', 'EDIT_DOCUMENT_METADATA', 'UPLOAD_REVISION_FILE', 'UPLOAD_TO_OFFICE_ONLINE',
    'EDIT_FILE_ONLINE', 'SUBMIT_REVISION', 'CANCEL_REVISION', 'VIEW_FINAL_PDF_PREVIEW', 'REQUEST_CONTROLLED_COPY'
)
WHERE r.name IN ('Document Owner', 'Author')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DOCUMENTS', 'EDIT_DOCUMENT_METADATA', 'EDIT_FILE_ONLINE', 'VIEW_FINAL_PDF_PREVIEW', 'REQUEST_CONTROLLED_COPY'
)
WHERE r.name IN ('Co-Author', 'Co-Authors', 'Co Author')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DOCUMENTS', 'COMPLETE_REVIEW', 'REJECT_REVISION', 'VIEW_FINAL_PDF_PREVIEW', 'VIEW_DOCUMENT_AUDIT_TRAIL'
)
WHERE r.name IN ('Reviewer', 'Reviewer Lead')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'VIEW_DOCUMENTS', 'APPROVE_REVISION', 'REJECT_REVISION', 'VIEW_FINAL_PDF_PREVIEW', 'VIEW_DOCUMENT_AUDIT_TRAIL'
)
WHERE r.name IN ('Approver', 'Approver Lead')
ON CONFLICT DO NOTHING;
